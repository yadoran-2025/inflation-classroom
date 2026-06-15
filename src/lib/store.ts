import { useEffect, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { lessonScenes } from '../data/lessonScenes'
import type { ClassDoc, LessonPosition, ResponseDoc, SpaceDoc, StudentDoc } from '../types'
import { db } from './firebase'
import { makeId } from './ids'
import { assignStudentCodes, formatStudentCode } from './studentCodes'

type LocalData = {
  spaces: Record<string, SpaceDoc>
  classes: Record<string, ClassDoc>
  students: Record<string, StudentDoc>
  responses: Record<string, ResponseDoc>
}

const localKey = 'inflation-classroom-store'
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('inflation-classroom-store') : null

function now(): number {
  return Date.now()
}

function responseDocId(response: Pick<ResponseDoc, 'studentId' | 'activity' | 'itemId'>): string {
  return [response.studentId, response.activity, response.itemId]
    .map((part) => encodeURIComponent(part))
    .join('__')
}

function emptyStore(): LocalData {
  return { spaces: {}, classes: {}, students: {}, responses: {} }
}

function migrateLocalStudentIdentifiers(data: LocalData): boolean {
  let changed = false
  const studentsByClass = Object.values(data.students).reduce<Record<string, StudentDoc[]>>((groups, student) => {
    groups[student.classId] = [...(groups[student.classId] ?? []), student]
    return groups
  }, {})

  for (const [classId, students] of Object.entries(studentsByClass)) {
    const { codesByStudentId, nextSequence } = assignStudentCodes(students)
    for (const student of students) {
      const studentCode = codesByStudentId.get(student.id)
      if (studentCode && student.nickname !== studentCode) {
        data.students[student.id] = { ...student, nickname: studentCode }
        changed = true
      }
    }

    for (const [responseId, response] of Object.entries(data.responses)) {
      if (response.classId !== classId) {
        continue
      }
      const studentCode = codesByStudentId.get(response.studentId)
      if (studentCode && response.studentNickname !== studentCode) {
        data.responses[responseId] = { ...response, studentNickname: studentCode }
        changed = true
      }
    }

    const classDoc = data.classes[classId]
    if (classDoc && (classDoc.nextStudentSequence ?? 0) < nextSequence) {
      data.classes[classId] = { ...classDoc, nextStudentSequence: nextSequence }
      changed = true
    }
  }

  return changed
}

function readLocal(): LocalData {
  if (typeof localStorage === 'undefined') {
    return emptyStore()
  }

  const raw = localStorage.getItem(localKey)
  if (!raw) {
    return emptyStore()
  }

  try {
    const data = { ...emptyStore(), ...JSON.parse(raw) } as LocalData
    if (migrateLocalStudentIdentifiers(data)) {
      localStorage.setItem(localKey, JSON.stringify(data))
    }
    return data
  } catch {
    return emptyStore()
  }
}

export async function migrateClassStudentIdentifiers(classId: string): Promise<void> {
  if (!db) {
    const data = readLocal()
    if (migrateLocalStudentIdentifiers(data)) {
      writeLocal(data)
    }
    return
  }

  const studentsSnapshot = await getDocs(collection(db, 'classes', classId, 'students'))
  const students = studentsSnapshot.docs.map((studentDoc) => ({
    id: studentDoc.id,
    ...studentDoc.data(),
  }) as StudentDoc)
  const { codesByStudentId, nextSequence } = assignStudentCodes(students)

  await runTransaction(db, async (transaction) => {
    const classRef = doc(db!, 'classes', classId)
    const classSnapshot = await transaction.get(classRef)
    if (classSnapshot.exists()) {
      const current = (classSnapshot.data() as ClassDoc).nextStudentSequence ?? 0
      if (current < nextSequence) {
        transaction.update(classRef, { nextStudentSequence: nextSequence, updatedAt: now() })
      }
    }
  })

  const responsesSnapshot = await getDocs(collection(db, 'classes', classId, 'responses'))
  const updates: Array<(batch: ReturnType<typeof writeBatch>) => void> = []

  for (const studentDoc of studentsSnapshot.docs) {
    const studentCode = codesByStudentId.get(studentDoc.id)
    if (studentCode && studentDoc.data().nickname !== studentCode) {
      updates.push((batch) => batch.update(studentDoc.ref, { nickname: studentCode }))
    }
  }

  for (const responseDoc of responsesSnapshot.docs) {
    const response = responseDoc.data() as ResponseDoc
    const studentCode = codesByStudentId.get(response.studentId)
    if (studentCode && response.studentNickname !== studentCode) {
      updates.push((batch) => batch.update(responseDoc.ref, { studentNickname: studentCode }))
    }
  }

  for (let index = 0; index < updates.length; index += 450) {
    const batch = writeBatch(db)
    updates.slice(index, index + 450).forEach((applyUpdate) => applyUpdate(batch))
    await batch.commit()
  }
}

function writeLocal(next: LocalData): void {
  localStorage.setItem(localKey, JSON.stringify(next))
  channel?.postMessage('changed')
  window.dispatchEvent(new Event('inflation-store-changed'))
}

function mutateLocal(mutator: (draft: LocalData) => void): void {
  const draft = readLocal()
  mutator(draft)
  writeLocal(draft)
}

function useLocalSelector<T>(selector: (data: LocalData) => T): T {
  const [, setVersion] = useState(0)

  useEffect(() => {
    const update = () => setVersion((version) => version + 1)
    window.addEventListener('storage', update)
    window.addEventListener('inflation-store-changed', update)
    channel?.addEventListener('message', update)

    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener('inflation-store-changed', update)
      channel?.removeEventListener('message', update)
    }
  }, [])

  return selector(readLocal())
}

export async function upsertSpace(space: Omit<SpaceDoc, 'createdAt'>): Promise<SpaceDoc> {
  const next: SpaceDoc = { ...space, createdAt: now() }

  if (db) {
    const ref = doc(db, 'spaces', next.id)
    const existing = await getDoc(ref)
    if (!existing.exists()) {
      await setDoc(ref, next)
    }
    return existing.exists() ? ({ id: existing.id, ...existing.data() } as SpaceDoc) : next
  }

  mutateLocal((draft) => {
    draft.spaces[next.id] = draft.spaces[next.id] ?? next
  })

  return readLocal().spaces[next.id]
}

export async function createClass(spaceId: string, name: string): Promise<ClassDoc> {
  const id = makeId('class')
  const next: ClassDoc = {
    id,
    spaceId,
    name,
    sceneIndex: 0,
    beatIndex: 0,
    nextStudentSequence: 0,
    createdAt: now(),
    updatedAt: now(),
  }

  if (db) {
    await setDoc(doc(db, 'classes', id), next)
    return next
  }

  mutateLocal((draft) => {
    draft.classes[id] = next
  })

  return next
}

export async function updateClassPosition(classId: string, position: LessonPosition): Promise<void> {
  const payload = { ...position, updatedAt: now() }

  if (db) {
    await updateDoc(doc(db, 'classes', classId), payload)
    return
  }

  mutateLocal((draft) => {
    const classDoc = draft.classes[classId]
    if (classDoc) {
      draft.classes[classId] = { ...classDoc, ...payload }
    }
  })
}

export async function startClassActivity(classId: string): Promise<void> {
  const payload = {
    sceneIndex: 0,
    beatIndex: 0,
    startedAt: now(),
    updatedAt: now(),
  }

  if (db) {
    await updateDoc(doc(db, 'classes', classId), payload)
    return
  }

  mutateLocal((draft) => {
    const classDoc = draft.classes[classId]
    if (classDoc) {
      draft.classes[classId] = { ...classDoc, ...payload }
    }
  })
}

export async function joinClass(classId: string): Promise<StudentDoc> {
  const id = makeId('student')

  if (db) {
    const classRef = doc(db, 'classes', classId)
    const studentRef = doc(db, 'classes', classId, 'students', id)

    return runTransaction(db, async (transaction) => {
      const classSnapshot = await transaction.get(classRef)
      if (!classSnapshot.exists()) {
        throw new Error('수업을 찾을 수 없습니다.')
      }

      const classData = classSnapshot.data() as ClassDoc
      const sequence = classData.nextStudentSequence ?? 0
      const timestamp = now()
      const next: StudentDoc = {
        id,
        classId,
        nickname: formatStudentCode(sequence),
        currentSceneIndex: 0,
        currentBeatIndex: 0,
        lastSeenAt: timestamp,
        createdAt: timestamp,
      }

      transaction.update(classRef, { nextStudentSequence: sequence + 1, updatedAt: timestamp })
      transaction.set(studentRef, next)
      return next
    })
  }

  let next: StudentDoc | null = null
  mutateLocal((draft) => {
    const classDoc = draft.classes[classId]
    if (!classDoc) {
      return
    }

    const sequence = classDoc.nextStudentSequence ?? 0
    const timestamp = now()
    next = {
      id,
      classId,
      nickname: formatStudentCode(sequence),
      currentSceneIndex: 0,
      currentBeatIndex: 0,
      lastSeenAt: timestamp,
      createdAt: timestamp,
    }
    draft.classes[classId] = { ...classDoc, nextStudentSequence: sequence + 1, updatedAt: timestamp }
    draft.students[id] = next
  })

  if (!next) {
    throw new Error('수업을 찾을 수 없습니다.')
  }

  return next
}

export async function markStudentPosition(
  classId: string,
  studentId: string,
  position: LessonPosition,
): Promise<void> {
  const payload = {
    currentSceneIndex: position.sceneIndex,
    currentBeatIndex: position.beatIndex,
    lastSeenAt: now(),
  }

  if (db) {
    await updateDoc(doc(db, 'classes', classId, 'students', studentId), payload)
    return
  }

  mutateLocal((draft) => {
    const student = draft.students[studentId]
    if (student) {
      draft.students[studentId] = { ...student, ...payload }
    }
  })
}

export async function deleteStudent(classId: string, studentId: string): Promise<void> {
  if (db) {
    const responsesQuery = query(
      collection(db, 'classes', classId, 'responses'),
      where('studentId', '==', studentId),
    )
    const responseSnapshot = await getDocs(responsesQuery)
    await Promise.all(responseSnapshot.docs.map((response) => deleteDoc(response.ref)))
    await deleteDoc(doc(db, 'classes', classId, 'students', studentId))
    return
  }

  mutateLocal((draft) => {
    delete draft.students[studentId]
    Object.keys(draft.responses).forEach((key) => {
      if (draft.responses[key].studentId === studentId) {
        delete draft.responses[key]
      }
    })
  })
}

export async function deleteClass(classId: string): Promise<void> {
  if (db) {
    const studentsSnapshot = await getDocs(collection(db, 'classes', classId, 'students'))
    const responsesSnapshot = await getDocs(collection(db, 'classes', classId, 'responses'))

    await Promise.all([
      ...studentsSnapshot.docs.map((student) => deleteDoc(student.ref)),
      ...responsesSnapshot.docs.map((response) => deleteDoc(response.ref)),
    ])
    await deleteDoc(doc(db, 'classes', classId))
    return
  }

  mutateLocal((draft) => {
    delete draft.classes[classId]
    Object.keys(draft.students).forEach((key) => {
      if (draft.students[key].classId === classId) {
        delete draft.students[key]
      }
    })
    Object.keys(draft.responses).forEach((key) => {
      if (draft.responses[key].classId === classId) {
        delete draft.responses[key]
      }
    })
  })
}

export async function submitResponse(
  response: Omit<ResponseDoc, 'id' | 'createdAt'>,
  previousResponse?: ResponseDoc,
): Promise<void> {
  const timestamp = now()
  const id = responseDocId(response)
  const next: ResponseDoc = {
    ...response,
    id,
    createdAt: previousResponse?.createdAt ?? timestamp,
    firstChoice: previousResponse?.firstChoice ?? previousResponse?.choice ?? response.choice,
    firstCorrect: previousResponse?.firstCorrect ?? previousResponse?.correct ?? response.correct,
    firstCreatedAt: previousResponse?.firstCreatedAt ?? previousResponse?.createdAt ?? timestamp,
    updatedAt: timestamp,
  }

  if (db) {
    await setDoc(doc(db, 'classes', response.classId, 'responses', id), next)
    return
  }

  mutateLocal((draft) => {
    const previous = draft.responses[id]
    draft.responses[id] = {
      ...next,
      createdAt: previous?.createdAt ?? next.createdAt,
      firstChoice: previous?.firstChoice ?? previous?.choice ?? next.firstChoice,
      firstCorrect: previous?.firstCorrect ?? previous?.correct ?? next.firstCorrect,
      firstCreatedAt: previous?.firstCreatedAt ?? previous?.createdAt ?? next.firstCreatedAt,
    }
  })
}

export function useSpace(spaceId: string | undefined): SpaceDoc | null {
  const localSpace = useLocalSelector(
    (data) => (spaceId ? data.spaces[spaceId] ?? null : null),
  )
  const [remoteSpace, setRemoteSpace] = useState<SpaceDoc | null>(null)

  useEffect(() => {
    if (!db || !spaceId) {
      return undefined
    }

    return onSnapshot(doc(db, 'spaces', spaceId), (snapshot) => {
      setRemoteSpace(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as SpaceDoc) : null)
    })
  }, [spaceId])

  return db ? remoteSpace : localSpace
}

export function useClasses(spaceId: string | undefined): ClassDoc[] {
  const localClasses = useLocalSelector(
    (data) =>
      Object.values(data.classes)
        .filter((classDoc) => classDoc.spaceId === spaceId)
        .sort((a, b) => a.createdAt - b.createdAt),
  )
  const [remoteClasses, setRemoteClasses] = useState<ClassDoc[]>([])

  useEffect(() => {
    if (!db || !spaceId) {
      return undefined
    }

    const classesQuery = query(collection(db, 'classes'), where('spaceId', '==', spaceId))
    return onSnapshot(classesQuery, (snapshot) => {
      setRemoteClasses(
        snapshot.docs
          .map((classDoc) => ({ id: classDoc.id, ...classDoc.data() }) as ClassDoc)
          .sort((a, b) => a.createdAt - b.createdAt),
      )
    })
  }, [spaceId])

  return db ? remoteClasses : localClasses
}

export function useClassDoc(classId: string | undefined): ClassDoc | null {
  const localClass = useLocalSelector(
    (data) => (classId ? data.classes[classId] ?? null : null),
  )
  const [remoteClass, setRemoteClass] = useState<ClassDoc | null>(null)

  useEffect(() => {
    if (!db || !classId) {
      return undefined
    }

    return onSnapshot(doc(db, 'classes', classId), (snapshot) => {
      setRemoteClass(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as ClassDoc) : null)
    })
  }, [classId])

  return db ? remoteClass : localClass
}

export function useStudents(classId: string | undefined): StudentDoc[] {
  const localStudents = useLocalSelector(
    (data) =>
      Object.values(data.students)
        .filter((student) => student.classId === classId)
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt),
  )
  const [remoteStudents, setRemoteStudents] = useState<StudentDoc[]>([])

  useEffect(() => {
    if (!db || !classId) {
      return undefined
    }

    return onSnapshot(collection(db, 'classes', classId, 'students'), (snapshot) => {
      setRemoteStudents(snapshot.docs.map((student) => ({ id: student.id, ...student.data() }) as StudentDoc))
    })
  }, [classId])

  return db ? remoteStudents : localStudents
}

export function useStudent(classId: string | undefined, studentId: string | undefined): StudentDoc | null {
  const localStudent = useLocalSelector(
    (data) => (classId && studentId ? data.students[studentId] ?? null : null),
  )
  const [remoteStudent, setRemoteStudent] = useState<StudentDoc | null>(null)

  useEffect(() => {
    if (!db || !classId || !studentId) {
      return undefined
    }

    return onSnapshot(doc(db, 'classes', classId, 'students', studentId), (snapshot) => {
      setRemoteStudent(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as StudentDoc) : null)
    })
  }, [classId, studentId])

  return db ? remoteStudent : localStudent
}

export function useStudentRecord(
  classId: string | undefined,
  studentId: string | undefined,
): { student: StudentDoc | null; isLoading: boolean } {
  const recordKey = classId && studentId ? `${classId}/${studentId}` : ''
  const localStudent = useLocalSelector(
    (data) => (classId && studentId ? data.students[studentId] ?? null : null),
  )
  const [remoteState, setRemoteState] = useState<{
    key: string
    student: StudentDoc | null
    isLoading: boolean
  }>({
    key: recordKey,
    student: null,
    isLoading: Boolean(db && classId && studentId),
  })

  useEffect(() => {
    if (!db || !classId || !studentId) {
      return undefined
    }

    return onSnapshot(doc(db, 'classes', classId, 'students', studentId), (snapshot) => {
      setRemoteState({
        key: `${classId}/${studentId}`,
        student: snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as StudentDoc) : null,
        isLoading: false,
      })
    })
  }, [classId, studentId])

  if (!db) {
    return { student: localStudent, isLoading: false }
  }

  return remoteState.key === recordKey
    ? remoteState
    : { student: null, isLoading: true }
}

export function useResponses(classId: string | undefined, enabled = true): ResponseDoc[] {
  const localResponses = useLocalSelector(
    (data) =>
      enabled
        ? Object.values(data.responses)
          .filter((response) => response.classId === classId)
          .sort((a, b) => a.createdAt - b.createdAt)
        : [],
  )
  const [remoteResponses, setRemoteResponses] = useState<ResponseDoc[]>([])

  useEffect(() => {
    if (!db || !classId || !enabled) {
      return undefined
    }

    return onSnapshot(collection(db, 'classes', classId, 'responses'), (snapshot) => {
      setRemoteResponses(snapshot.docs.map((response) => ({ id: response.id, ...response.data() }) as ResponseDoc))
    })
  }, [classId, enabled])

  return db && enabled ? remoteResponses : localResponses
}

export function useStudentResponses(classId: string | undefined, studentId: string | undefined): ResponseDoc[] {
  const localResponses = useLocalSelector(
    (data) =>
      Object.values(data.responses)
        .filter((response) => response.classId === classId && response.studentId === studentId)
        .sort((a, b) => a.createdAt - b.createdAt),
  )
  const [remoteResponses, setRemoteResponses] = useState<ResponseDoc[]>([])

  useEffect(() => {
    if (!db || !classId || !studentId) {
      return undefined
    }

    const responsesQuery = query(
      collection(db, 'classes', classId, 'responses'),
      where('studentId', '==', studentId),
    )

    return onSnapshot(responsesQuery, (snapshot) => {
      setRemoteResponses(snapshot.docs.map((response) => ({ id: response.id, ...response.data() }) as ResponseDoc))
    })
  }, [classId, studentId])

  return db ? remoteResponses : localResponses
}

export function getJoinUrl(classId: string): string {
  return `${window.location.origin}/join/${classId}`
}

export function currentSceneTitle(position: LessonPosition): string {
  const scene = lessonScenes[position.sceneIndex]
  const beat = scene?.beats[position.beatIndex]
  return scene && beat ? `${scene.number}. ${scene.title} / ${position.beatIndex + 1}` : '시작 전'
}
