
const test = require('tape')
const models = require('@tradle/models')
const builderFor = require('./')

test('build resource', function (t) {
  const model = models['tradle.Profile']
  const builder = builderFor({ models, model })

  t.throws(builder.toJSON, /required/)
  builder.firstName('ted')
  t.same(builder.toJSON(), {
    _t: model.id,
    firstName: 'ted'
  })

  const photos = [
    {
      _t: 'tradle.Photo',
      url: 'http://bill.ted'
    }
  ]

  builder.photos(photos)

  t.same(builder.toJSON(), {
    _t: model.id,
    firstName: 'ted',
    photos
  })

  t.throws(() => builder.firstName(2), /string/i)

  t.throws(() => builder.useTouchId('hey'), /boolean/i)
  t.doesNotThrow(() => builder.useTouchId(true))

  t.throws(() => builder.lastMessageTime('hey'), /date/i)

  const lastMessageTime = Date.now()
  t.doesNotThrow(() => builder.lastMessageTime(lastMessageTime))

  builder.myDocuments([
    {
      _s: 'somesig',
      _t: 'tradle.MediaSnippet',
      summary: 'b',
      publisher: 'someone',
      datePublished: '01/01/2001'
    }
  ])

  t.same(builder.toJSON(), {
    _t: 'tradle.Profile',
    firstName: 'ted',
    photos: [{ _t: 'tradle.Photo', url: 'http://bill.ted' }],
    useTouchId: true,
    lastMessageTime,
    myDocuments: [{
      id: 'tradle.MediaSnippet_52d74a7f7d80eba71b175c2dbcbe907be280aeb111a5929b0aa0dd3ac578256c_52d74a7f7d80eba71b175c2dbcbe907be280aeb111a5929b0aa0dd3ac578256c',
      title: ''
    }]
  })

  t.end()
})
