export type SearchReplaceViewStatus = {
  running: boolean
  completed: number
  total: number
  error?: Error
}

export type SearchReplaceViewValues = {
  find: string
  replace: string
  include: string
  exclude: string
}

export type MessageToWebview = {
  type: 'status'
  status: Partial<SearchReplaceViewStatus>
}

export type MessageFromWebview =
  | {
      type: 'values'
      values: SearchReplaceViewValues
    }
  | {
      type: 'search'
      find: string
      replace: string
      include: string
      exclude: string
    }
  | {
      type: 'replace'
    }
