export type SearchReplaceViewStatus = {
  running: boolean
  completed: number
  total: number
  error?: Error
  numMatches: number
  numFilesThatWillChange: number
  numFilesWithMatches: number
  numFilesWithErrors: number
}

export type SearchReplaceViewValues = {
  find: string
  replace: string
  include: string
  exclude: string
}

export type MessageToWebview =
  | {
      type: 'status'
      status: Partial<SearchReplaceViewStatus>
    }
  | {
      type: 'values'
      values: Partial<SearchReplaceViewValues>
    }

export type MessageFromWebview =
  | {
      type: 'mount'
    }
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
