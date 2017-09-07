
const test = require('tape')
const mergeModels = require('@tradle/merge-models')
const models = mergeModels()
  .add(require('@tradle/models').models)
  .add(require('@tradle/custom-models'))
  .get()

const { TYPE, PREVLINK, PERMALINK } = require('@tradle/constants')
const { utils } = require('@tradle/engine')
const buildResource = require('./')

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

  builder.previous('abc')
  t.same(builder.get(PREVLINK), 'abc')

  builder.original('aaa')
  t.same(builder.get(PERMALINK), 'aaa')
  t.end()
})

test('links', function (t) {
  const obj = {
    _t: 'something',
    _s: 'blah',
    _virtual: ['_link', '_permalink'],
    _link: 'fakelink',
    // ignored
    _permalink: 'fakepermalink'
  }

  t.equal(buildResource.link(obj), obj._link)
  t.equal(buildResource.calcLink(obj), utils.hexLink(obj))
  t.same(buildResource.links(obj), { link: obj._link, permalink: obj._link })
  t.same(buildResource.calcLinks(obj), utils.getLinks({
    object: buildResource.omitVirtual(obj)
  }))

  t.end()
})

test('setVirtual', function (t) {
  const res = buildResource({
    models,
    model: 'tradle.Profile'
  })
  .set({ firstName: 'bob' })
  .setVirtual({
    _link: 'blah'
  })
  .toJSON()

  t.same(res, {
    [TYPE]: 'tradle.Profile',
    firstName: 'bob',
    _link: 'blah',
    _virtual: ['_link']
  })

  t.end()
})

test('writeTo', function (t) {
  var resource = {}
  buildResource({
    models,
    model: 'tradle.Profile',
    resource
  })
  .set('firstName', 'bob')
  .writeTo(resource)

  t.same(resource, {
    [TYPE]: 'tradle.Profile',
    firstName: 'bob'
  })

  const profile = { [TYPE]: 'tradle.Profile', firstName: 'bob' }
  buildResource.set({
    models,
    model: 'tradle.Profile',
    resource: profile,
    properties: {
      lastName: 'boogie'
    }
  })

  t.same(profile,  {
    [TYPE]: 'tradle.Profile',
    firstName: 'bob',
    lastName: 'boogie'
  })

  t.end()
})

test('enum value', function (t) {
  const val = buildResource.enumValue({
    model: models['tradle.MaritalStatus'],
    value: 'married'
  })

  t.same(val, {
    id: 'tradle.MaritalStatus_married',
    title: 'Married'
  })

  t.throws(() => {
    buildResource.enumValue({
      model: models['tradle.MaritalStatus'],
      value: 'tinder'
    })
  }, /not found/)

  const aboutYou = buildResource({
      models,
      model: 'tradle.AboutYou'
    })
    .set({
      maritalStatus: 'married',
    })
    .toJSON()

  t.same(aboutYou, {
    _t: 'tradle.AboutYou',
    maritalStatus: {
      id: 'tradle.MaritalStatus_married',
      title: 'Married'
    }
  })

  t.end()
})
