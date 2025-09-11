

export type DataSource = {
  api: string;
  secret: string;
}

export type StatusGroupType = {
  name: string;
  alias?: string;
  list: StatusItemType[];

}

export type StatusItemType = {
  name: string;
  alias?: string;
  status: string;
}

export type ReqApi = {
  api: string
  secret: string
}

export type Report = {
  name: string
  description: string
}

export type ReqReport = {
  api: string
  secret: string
  report: string
}

export type SecretType = {
  secret: string
}

