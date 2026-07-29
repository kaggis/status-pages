export type DowntimeSeverity = 'Outage' | 'Warning'

export type DowntimeClassification = 'SCHEDULED' | 'UNSCHEDULED'

export type DowntimeServiceRequest = {
  hostname?: string
  service?: string
}

export type DowntimeServiceResponse = {
  id: string
  hostname: string
  service: string
}

export type DowntimeRequest = {
  name: string
  severity: DowntimeSeverity
  message?: string
  scheduled_at: string
  completed_at: string
  services: DowntimeServiceRequest[]
}

export type Downtime = {
  id: string
  name: string
  severity: DowntimeSeverity
  message?: string
  scheduled_at: string
  completed_at: string
  classification: DowntimeClassification
  services: DowntimeServiceResponse[]
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
}

export type DowntimesResponse = {
  content: Downtime[]
  size_of_page: number
  number_of_page: number
  total_elements: number
  total_pages: number
}
