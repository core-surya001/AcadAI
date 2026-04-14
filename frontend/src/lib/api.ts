// =============================================================================
// AcadAI — API Service (Connected to Express Backend)
// -----------------------------------------------------------------------------
// All functions talk to the real backend at NEXT_PUBLIC_API_URL.
// Functions without a backend endpoint still return mock data (marked with 📌).
// =============================================================================

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high';

export interface Student {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  grade: string;
  major: string;
  semester: string;
  attendance: number;   // 0–100
  score: number;        // 0–10
  riskLevel: RiskLevel;
  aiPrediction?: number; // 0–100
}

export interface DashboardStats {
  totalStudents: number;
  totalStudentsTrend: number;
  averageScore: number;
  averageScoreTrend: number;
  atRiskStudents: number;
  atRiskNew: number;
}

export interface ActivityItem {
  id: string;
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  time: string;
}

export interface Report {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'processing' | 'draft' | 'archived';
  icon: string;
  iconColor: string;
  lastUpdated?: string;
  progress?: number;
  tag?: string;
  archiveId?: string;
  sections?: number;
}

export interface ClassDistribution {
  name: string;
  percent: number;
  students: number;
  color: string;
}

export interface PerformanceTrend {
  day: string;
  value: number;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
}

export interface PreviewRow {
  id: string;
  name: string;
  email: string;
  grade: string;
  status: 'valid' | 'invalid';
  error?: string;
}

// ─── Token helpers ────────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('acadai_token');
}

function saveToken(token: string): void {
  localStorage.setItem('acadai_token', token);
}

function clearToken(): void {
  localStorage.removeItem('acadai_token');
  localStorage.removeItem('acadai_user');
}

function saveUser(user: { name: string; role: string }): void {
  localStorage.setItem('acadai_user', JSON.stringify(user));
}

export function getStoredUser(): { name: string; role: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('acadai_user');
  return raw ? JSON.parse(raw) : null;
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function logout(): void {
  clearToken();
  window.location.href = '/login';
}

// ─── Fetch wrapper ────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // Token expired or invalid — redirect to login
    clearToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Session expired');
  }

  const body = await res.json();

  if (!res.ok) {
    const message = body.message || body.errors?.[0]?.message || 'Request failed';
    throw new Error(message);
  }

  return body;
}

// ─── Snake → Camel case mapper for student records ─────────────────────────────

function mapStudent(row: Record<string, unknown>): Student {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    avatar: (row.avatar as string) || undefined,
    grade: row.grade as string,
    major: row.major as string,
    semester: row.semester as string,
    attendance: Number(row.attendance),
    score: Number(row.score),
    riskLevel: (row.risk_level ?? row.riskLevel ?? 'low') as RiskLevel,
    aiPrediction: row.ai_prediction != null
      ? Number(row.ai_prediction)
      : row.aiPrediction != null
        ? Number(row.aiPrediction)
        : undefined,
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: { name: string; role: string } }> {
  const body = await apiFetch<{
    success: boolean;
    data: { token: string; user: { id: string; name: string; email: string; role: string } };
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  saveToken(body.data.token);
  saveUser({ name: body.data.user.name, role: body.data.user.role });

  return { token: body.data.token, user: { name: body.data.user.name, role: body.data.user.role } };
}

export async function register(
  name: string,
  email: string,
  password: string,
  role: string = 'teacher',
): Promise<{ token: string; user: { name: string; role: string } }> {
  const body = await apiFetch<{
    success: boolean;
    data: { token: string; user: { id: string; name: string; email: string; role: string } };
  }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, role }),
  });

  saveToken(body.data.token);
  saveUser({ name: body.data.user.name, role: body.data.user.role });

  return { token: body.data.token, user: { name: body.data.user.name, role: body.data.user.role } };
}

export async function googleLogin(
  credential: string,
): Promise<{ token: string; user: { name: string; role: string } }> {
  const body = await apiFetch<{
    success: boolean;
    data: { token: string; user: { id: string; name: string; email: string; role: string } };
  }>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  });

  saveToken(body.data.token);
  saveUser({ name: body.data.user.name, role: body.data.user.role });

  return { token: body.data.token, user: { name: body.data.user.name, role: body.data.user.role } };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const body = await apiFetch<{ success: boolean; data: DashboardStats }>('/dashboard/stats');
  return body.data;
}

export async function getClassDistribution(): Promise<ClassDistribution[]> {
  const body = await apiFetch<{ success: boolean; data: ClassDistribution[] }>('/dashboard/class-distribution');
  return body.data;
}

// 📌 No backend endpoint yet — stays mock
export async function getPerformanceTrends(): Promise<PerformanceTrend[]> {
  return [
    { day: 'Mon', value: 45 }, { day: 'Tue', value: 60 }, { day: 'Wed', value: 85 },
    { day: 'Thu', value: 70 }, { day: 'Fri', value: 55 }, { day: 'Sat', value: 90 },
    { day: 'Sun', value: 75 },
  ];
}

// 📌 No backend endpoint yet — stays mock
export async function getRecentActivity(): Promise<ActivityItem[]> {
  return [
    { id: '1', icon: 'assignment_turned_in', iconColor: 'text-indigo-500', title: 'New Grade Posted',    description: 'CS101 Quiz #3 results released',           time: '2 mins ago' },
    { id: '2', icon: 'flag',                 iconColor: 'text-amber-500',  title: 'Attendance Alert',   description: 'Student ID #442 missed 3 sessions',        time: '1 hour ago' },
    { id: '3', icon: 'cloud_upload',         iconColor: 'text-emerald-500',title: 'Data Sync Complete', description: 'Canvas integration updated successfully',   time: '3 hours ago' },
    { id: '4', icon: 'person_add',           iconColor: 'text-indigo-500', title: 'New Enrollment',     description: 'Sarah Jenkins joined Advanced ML',          time: '5 hours ago' },
  ];
}

// ─── Students (CRUD) ─────────────────────────────────────────────────────────

export async function getStudents(params?: {
  search?: string;
  grade?: string;
  risk?: string;
  sort?: string;
  page?: number;
}): Promise<{ students: Student[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.grade && params.grade !== 'all') query.set('grade', params.grade);
  if (params?.risk && params.risk !== 'all') query.set('risk', params.risk);
  if (params?.sort) query.set('sort', params.sort);
  if (params?.page) query.set('page', String(params.page));

  const qs = query.toString();
  const body = await apiFetch<{
    success: boolean;
    students: Record<string, unknown>[];
    total: number;
  }>(`/students${qs ? `?${qs}` : ''}`);

  return {
    students: body.students.map(mapStudent),
    total: body.total,
  };
}

export async function getStudentById(id: string): Promise<Student | null> {
  try {
    const body = await apiFetch<{
      success: boolean;
      data: Record<string, unknown>;
    }>(`/students/${id}`);
    return mapStudent(body.data);
  } catch {
    return null;
  }
}

export async function createStudent(data: Partial<Student>): Promise<Student> {
  const body = await apiFetch<{ success: boolean; data: Record<string, unknown> }>('/students', {
    method: 'POST',
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      grade: data.grade,
      major: data.major,
      semester: data.semester,
      attendance: data.attendance,
      score: data.score,
      avatar: data.avatar,
    }),
  });
  return mapStudent(body.data);
}

export async function updateStudent(id: string, data: Partial<Student>): Promise<Student> {
  const body = await apiFetch<{ success: boolean; data: Record<string, unknown> }>(`/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      grade: data.grade,
      major: data.major,
      semester: data.semester,
      attendance: data.attendance,
      score: data.score,
      avatar: data.avatar,
    }),
  });
  return mapStudent(body.data);
}

export async function deleteStudent(id: string): Promise<void> {
  await apiFetch(`/students/${id}`, { method: 'DELETE' });
}

// ─── Reports (📌 mock — no backend endpoint) ──────────────────────────────────

export async function getReports(): Promise<Report[]> {
  return [
    { id: 'r1', title: 'Final Grades Summary',    description: 'Comprehensive breakdown of student performance across all core engineering modules for Q1.',  status: 'completed',  icon: 'bar_chart',    iconColor: 'text-indigo-600', lastUpdated: '2h ago' },
    { id: 'r2', title: 'Attendance Trends',        description: 'Visualizing student engagement and physical attendance patterns vs hybrid learning metrics.', status: 'processing', icon: 'query_stats',  iconColor: 'text-purple-600', progress: 67 },
    { id: 'r3', title: 'AI Assignment Insights',   description: 'Evaluation of AI-driven assessment tools and their impact on student learning curves.',       status: 'completed',  icon: 'history_edu',  iconColor: 'text-amber-500',  tag: 'Top Performer: CS 101', lastUpdated: '1d ago' },
    { id: 'r4', title: 'Risk Assessment 2023',     description: 'Historical report identifying students at risk of dropping out based on early warning signs.', status: 'archived',   icon: 'warning',      iconColor: 'text-rose-500',   archiveId: '#ARC-2023-04' },
    { id: 'r5', title: 'Scholarship Eligibility',  description: 'Drafting criteria for merit-based scholarships for the upcoming academic year.',              status: 'draft',      icon: 'edit_note',    iconColor: 'text-slate-400',  sections: 3 },
  ];
}

// ─── Upload (📌 mock — no backend endpoint) ───────────────────────────────────

export async function getUploadPreview(): Promise<PreviewRow[]> {
  await new Promise((r) => setTimeout(r, 800));
  return [
    { id: '#STU-29384', name: 'Jordan Mitchell', email: 'j.mitchell@academy.edu', grade: '11th Grade', status: 'valid' },
    { id: '#STU-29401', name: 'Sarah Jenkins',   email: 's.jenkins@academy.edu',  grade: '10th Grade', status: 'valid' },
    { id: '#STU-29415', name: 'David Chen',      email: 'd.chen@academy.edu',     grade: 'N/A',        status: 'invalid', error: 'INVALID GRADE' },
    { id: '#STU-29422', name: 'Elena Rodriguez', email: 'e.rod@academy.edu',      grade: '12th Grade', status: 'valid' },
    { id: '#STU-29448', name: 'Marcus Thorne',   email: 'm.thorne@academy.edu',   grade: '11th Grade', status: 'valid' },
  ];
}

export async function uploadFile(_file: File): Promise<{ jobId: string }> {
  await new Promise((r) => setTimeout(r, 1000));
  return { jobId: `job-${Date.now()}` };
}
