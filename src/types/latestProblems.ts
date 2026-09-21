export interface LatestMetricData {
  endpoint_group: string
  service: string
  endpoint: string
  metric: string
  timestamp: string
  status: string
  summary: string
  message: string
}

export interface LatestMetricDataResponse {
  status: {
    message: string
    code: string
  }
  data: {
    metric_data: LatestMetricData[]
  }
}
