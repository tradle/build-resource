
const test = require('tape')
const models = require('@tradle/models')
const buildResource = require('./')

test('link', function (t) {
  const model = {
    id: 'hey',
    type: 'tradle.Model',
    properties: {
      a: {
        type: 'string',
        virtual: true
      },
      b: {
        type: 'string'
      }
    }
  }

  const resource = {
    // undeclared
    _googa: 'goo',
    googa: 'goog',
    // protocol props
    _t: 'hey',
    _s: 'sig',
    _n: 1,
    _q: 'aha',
    _p: 'dsa',
    _r: 'asdf',
    // virtual
    a: 'a',
    // declared
    b: 'b'
  }

  const linkProperties = buildResource.linkProperties({ model, resource })
  t.same(linkProperties, {
    _t: 'hey',
    _s: 'sig',
    _n: 1,
    _q: 'aha',
    _p: 'dsa',
    _r: 'asdf',
    b: 'b'
  })

  t.end()
})

test('build resource', function (t) {
  const model = models['tradle.Profile']
  const builder = buildResource({ models, model })

  t.throws(builder.toJSON, /required/)
  builder.set('firstName', 'ted')
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

  builder.set('photos', photos)

  t.same(builder.toJSON(), {
    _t: model.id,
    firstName: 'ted',
    photos
  })

  t.throws(() => builder.set('firstName', 2), /string/i)

  t.throws(() => builder.set('useTouchId', 'hey'), /boolean/i)
  t.doesNotThrow(() => builder.set('useTouchId', true))

  t.throws(() => builder.set('lastMessageTime', 'hey'), /date/i)

  const lastMessageTime = Date.now()
  t.doesNotThrow(() => builder.set('lastMessageTime', lastMessageTime))

  builder.set('myDocuments', [
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
      title: 'b'
    }]
  })

  t.throws(() => builder.remove('photos', { _t: 'tradle.Photo' }))
  builder.add('photos', { _t: 'tradle.Photo' })
  t.same(builder.get('photos'), [
    { _t: 'tradle.Photo', url: 'http://bill.ted' },
    { _t: 'tradle.Photo' }
  ])

  builder.remove('photos', { _t: 'tradle.Photo' })
  t.same(builder.get('photos'), [
    { _t: 'tradle.Photo', url: 'http://bill.ted' }
  ])

  builder.filterOut('photos', photo => {
    return photo._t === 'blah'
  })

  t.same(builder.get('photos'), [
    { _t: 'tradle.Photo', url: 'http://bill.ted' }
  ])

  builder.filterOut('photos', photo => photo._t === 'tradle.Photo')
  t.same(builder.get('photos'), [])
  t.end()
})
