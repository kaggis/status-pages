import type { Report, ReqApi, ReqReport,  StatusItemType } from "@/types/common"

const BACKEND_API = import.meta.env.VITE_BACKEND_URI


export const fetchEncrypted = async (secret: string, token: string): Promise<string> => {
  const response = await fetch(`${BACKEND_API}/v1/encrypt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ secret: secret }),
  });

  if (!response.ok) {
    throw new Error('Failed to encrypt');
  }

  const data = await response.json();
  return data.secret;
};


export const fetchReportsApi = async (
  data: ReqApi,
  token: string,
): Promise<Report[]> => {
  const response = await fetch(`${BACKEND_API}/v1/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      errorData.message || `HTTP error! status: ${response.status}`,
    )
  }

  return response.json()
}

export const fetchGroupsApi = async (
  data: ReqReport,
  token: string,
): Promise<StatusItemType[]> => {
  const response = await fetch(`${BACKEND_API}/v1/status/groups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      errorData.message || `HTTP error! status: ${response.status}`,
    )
  }

  return response.json()
}
