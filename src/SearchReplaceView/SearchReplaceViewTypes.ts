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

export type AstxParser =
  | 'babel'
  | 'babel/auto'
  | 'recast/babel'
  | 'recast/babel/auto'

export type SearchReplaceViewValues = {
  find: string
  replace: string
  include: string
  exclude: string
  parser?: AstxParser
  prettier?: boolean
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
  | ({
      type: 'search'
    } & SearchReplaceViewValues)
  | {
      type: 'replace'
    }
