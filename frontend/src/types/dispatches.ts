export type CultureCenterBrief = {
  id: number;
  center?: number;
  region?: number;
  branch_name?: string;
  address_detail?: string;
  center_phone?: string | null;
  manager_name?: string | null;
  manager_phone?: string | null;
  manager_email?: string | null;

  // detail
  center_name?: string;
  region_name?: string;
};

export type CultureCenterDetail = {
  id: number;
  center: { id: number; name: string };
  region: { id: number; name: string };
  branch_name: string;
  address_detail: string;
  center_phone: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  manager_email: string | null;
  latitude: string | null;
  longitude: string | null;
};

export type DispatchRequest = {
  id: number;
  culture_center: number;
  culture_center_detail?: {
    id: number;
    center_name: string;
    region_name: string;
    branch_name: string;
  };

  requested_by: number;
  requested_by_email?: string;

  teaching_language: string;
  course_title: string;

  weekdays: string[];

  start_time: string; // "09:00:00" or "09:00"
  end_time: string;

  start_date: string;
  end_date: string;

  target?: string;
  level?: string;
  headcount?: number | null;
  is_online?: boolean;
  requirements?: string;
  notes?: string;

  requester_name: string;
  requester_phone: string;
  requester_email: string;

  status: string;
  published_at?: string | null;
  application_deadline?: string | null;

  applications_count?: number;
  is_applied?: boolean;

  created_at?: string;
  updated_at?: string;

  assignment?: any;
};

export type DispatchApplication = {
  id: number;
  dispatch_request: number;
  teacher_application: number;
  teacher_name: string;
  teacher_email: string;
  message?: string;
  status: string;
  created_at: string;
};

export type DispatchAssignment = {
  id: number;
  dispatch_request: number;
  selected_application: number;
  selected_application_detail?: any;
  status: string;
  admin_memo?: string;
  created_at: string;
};
