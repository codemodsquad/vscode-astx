import { describe, it } from 'mocha'
import { expect } from 'chai'
import { convertGlobPattern } from '../../extension/convertGlobPattern'

describe(`convertGlobPattern`, function () {
  it(`basic test`, function () {
    expect(
      convertGlobPattern('src/**/*.js,a/foo,/bc,b/qux, ./test, a/{bar,baz}', [
        '/a',
        '/x/b',
      ])
    ).to.equal(
      '{/bc,/a/{foo,{bar,baz}},/x/b/qux,{/a,/x/b}/{**/src/**/*.js,./test}}'
    )
  })
})
