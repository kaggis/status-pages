import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { fetchGroupsApi } from '../api/data'

type ApiGroup = {
  api: string
  secret: string
  report: string
}

type GroupStatus = {
  name: string
  status: string
}

export const useGroupsMutation = () => {
  const { token } = useAuth(); 

  return useMutation<GroupStatus[], Error, ApiGroup>({
    mutationFn: (data: ApiGroup) => {
      if (!token) {
        throw new Error('No authentication token available')
      }
      return fetchGroupsApi(data, token)
    },
    onSuccess: (data) => {
      console.log('Report API success:', data)
    },
    onError: (error) => {
      console.error('Report API error:', error)
    },
  })
}
