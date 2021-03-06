var get = Ember.get, set = Ember.set;

var adapter, store, serializer, ajaxUrl, ajaxType, ajaxHash;
var Person, person, people;
var Role, role, roles;
var Group, group;

module("the REST adapter", {
  setup: function() {
    ajaxUrl = undefined;
    ajaxType = undefined;
    ajaxHash = undefined;

    var Adapter = DS.RESTAdapter.extend();
    Adapter.configure('plurals', {
      person: 'people'
    });

    adapter = Adapter.create({
      ajax: function(url, type, hash) {
        var success = hash.success, self = this;

        hash.context = adapter;

        ajaxUrl = url;
        ajaxType = type;
        ajaxHash = hash;

        if (success) {
          hash.success = function(json) {
            success.call(self, json);
          };
        }
      }
    });

    serializer = get(adapter, 'serializer');

    store = DS.Store.create({
      adapter: adapter
    });

    Person = DS.Model.extend({
      name: DS.attr('string')
    });

    Person.toString = function() {
      return "App.Person";
    };

    Group = DS.Model.extend({
      name: DS.attr('string'),
      people: DS.hasMany(Person)
    });

    Group.toString = function() {
      return "App.Group";
    };

    Person.reopen({
      group: DS.belongsTo(Group)
    });

    Role = DS.Model.extend({
      name: DS.attr('string')
    });

    Role.toString = function() {
      return "App.Role";
    };
  },

  teardown: function() {
    if (person) {
      person.destroy();
      person = null;
    }

    adapter.destroy();
    store.destroy();
  }
});

var expectUrl = function(url, desc) {
  equal(ajaxUrl, url, "the URL is " + desc);
};

var expectType = function(type) {
  equal(type, ajaxType, "the HTTP method is " + type);
};

var expectData = function(hash) {
  deepEqual(hash, ajaxHash.data, "the hash was passed along");
};

var expectState = function(state, value, p) {
  p = p || person;

  if (value === undefined) { value = true; }

  var flag = "is" + state.charAt(0).toUpperCase() + state.substr(1);
  equal(get(p, flag), value, "the person is " + (value === false ? "not " : "") + state);
};

var expectStates = function(state, value) {
  people.forEach(function(person) {
    expectState(state, value, person);
  });
};

test("creating a person makes a POST to /people, with the data hash", function() {
  person = store.createRecord(Person, { name: "Tom Dale" });

  expectState('new');
  store.commit();
  expectState('saving');

  expectUrl("/people", "the collection at the plural of the model name");
  expectType("POST");
  expectData({ person: { name: "Tom Dale" } });

  ajaxHash.success({ person: { id: 1, name: "Tom Dale" } });
  expectState('saving', false);

  equal(person, store.find(Person, 1), "it is now possible to retrieve the person by the ID supplied");
});

test("singular creations can sideload data", function() {
  person = store.createRecord(Person, { name: "Tom Dale" });

  expectState('new');
  store.commit();
  expectState('saving');

  expectUrl("/people", "the collection at the plural of the model name");
  expectType("POST");
  expectData({ person: { name: "Tom Dale" } });

  ajaxHash.success({
    person: { id: 1, name: "Tom Dale" },
    groups: [{ id: 1, name: "Group 1" }]
  });

  expectState('saving', false);

  equal(person, store.find(Person, 1), "it is now possible to retrieve the person by the ID supplied");

  group = store.find(Group, 1);
  equal(get(group, 'name'), "Group 1", "the data sideloaded successfully");
});

test("updating a person makes a PUT to /people/:id with the data hash", function() {
  store.load(Person, { id: 1, name: "Yehuda Katz" });

  person = store.find(Person, 1);

  expectState('new', false);
  expectState('loaded');
  expectState('dirty', false);

  set(person, 'name', "Brohuda Brokatz");

  expectState('dirty');
  store.commit();
  expectState('saving');

  expectUrl("/people/1", "the plural of the model name with its ID");
  expectType("PUT");

  ajaxHash.success({ person: { id: 1, name: "Brohuda Brokatz" } });
  expectState('saving', false);

  equal(person, store.find(Person, 1), "the same person is retrieved by the same ID");
  equal(get(person, 'name'), "Brohuda Brokatz", "the hash should be updated");
});

test("updates are not required to return data", function() {
  store.load(Person, { id: 1, name: "Yehuda Katz" });

  person = store.find(Person, 1);

  expectState('new', false);
  expectState('loaded');
  expectState('dirty', false);

  set(person, 'name', "Brohuda Brokatz");

  expectState('dirty');
  store.commit();
  expectState('saving');

  expectUrl("/people/1", "the plural of the model name with its ID");
  expectType("PUT");

  ajaxHash.success();
  expectState('saving', false);

  equal(person, store.find(Person, 1), "the same person is retrieved by the same ID");
  equal(get(person, 'name'), "Brohuda Brokatz", "the data is preserved");
});

test("singular updates can sideload data", function() {
  serializer.configure(Group, { sideloadAs: 'groups' });

  store.load(Person, { id: 1, name: "Yehuda Katz" });

  person = store.find(Person, 1);

  expectState('new', false);
  expectState('loaded');
  expectState('dirty', false);

  set(person, 'name', "Brohuda Brokatz");

  expectState('dirty');
  store.commit();
  expectState('saving');

  expectUrl("/people/1", "the plural of the model name with its ID");
  expectType("PUT");

  ajaxHash.success({
    person: { id: 1, name: "Brohuda Brokatz" },
    groups: [{ id: 1, name: "Group 1" }]
  });

  expectState('saving', false);

  equal(person, store.find(Person, 1), "the same person is retrieved by the same ID");

  group = store.find(Group, 1);
  equal(get(group, 'name'), "Group 1", "the data sideloaded successfully");
});

test("deleting a person makes a DELETE to /people/:id", function() {
  store.load(Person, { id: 1, name: "Tom Dale" });

  person = store.find(Person, 1);

  expectState('new', false);
  expectState('loaded');
  expectState('dirty', false);

  person.deleteRecord();

  expectState('dirty');
  expectState('deleted');
  store.commit();
  expectState('saving');

  expectUrl("/people/1", "the plural of the model name with its ID");
  expectType("DELETE");

  ajaxHash.success();
  expectState('deleted');
});

test("singular deletes can sideload data", function() {
  serializer.configure(Group, { sideloadAs: 'groups' });

  store.load(Person, { id: 1, name: "Tom Dale" });

  person = store.find(Person, 1);

  expectState('new', false);
  expectState('loaded');
  expectState('dirty', false);

  person.deleteRecord();

  expectState('dirty');
  expectState('deleted');
  store.commit();
  expectState('saving');

  expectUrl("/people/1", "the plural of the model name with its ID");
  expectType("DELETE");

  ajaxHash.success({
    groups: [{ id: 1, name: "Group 1" }]
  });

  expectState('deleted');

  group = store.find(Group, 1);
  equal(get(group, 'name'), "Group 1", "the data sideloaded successfully");
});

/*
test("deleting a record with custom primaryKey", function() {
  store.load(Role, { _id: 1, name: "Developer" });

  role = store.find(Role, 1);

  role.deleteRecord();

  store.commit();

  expectUrl("/roles/1", "the plural of the model name with its ID");
  ajaxHash.success();
});
*/

test("finding all people makes a GET to /people", function() {
  people = store.find(Person);

  expectUrl("/people", "the plural of the model name");
  expectType("GET");

  ajaxHash.success({ people: [{ id: 1, name: "Yehuda Katz" }] });

  person = people.objectAt(0);

  expectState('loaded');
  expectState('dirty', false);

  equal(person, store.find(Person, 1), "the record is now in the store, and can be looked up by ID without another Ajax request");
});

test("finding all can sideload data", function() {
  var groups = store.find(Group);

  expectUrl("/groups", "the plural of the model name");
  expectType("GET");

  ajaxHash.success({
    groups: [{ id: 1, name: "Group 1", person_ids: [ 1 ] }],
    people: [{ id: 1, name: "Yehuda Katz" }]
  });

  people = get(groups.objectAt(0), 'people');
  person = people.objectAt(0);

  expectState('loaded');
  expectState('dirty', false);

  equal(person, store.find(Person, 1), "the record is now in the store, and can be looked up by ID without another Ajax request");
});

test("finding all people with since makes a GET to /people", function() {
  people = store.find(Person);

  expectUrl("/people", "the plural of the model name");
  expectType("GET");

  ajaxHash.success({ meta: { since: '123'}, people: [{ id: 1, name: "Yehuda Katz" }] });

  people = store.find(Person);

  expectUrl("/people", "the plural of the model name");
  expectType("GET");
  expectData({since: '123'});

  ajaxHash.success({ meta: { since: '1234'}, people: [{ id: 2, name: "Paul Chavard" }] });

  person = people.objectAt(1);

  expectState('loaded');
  expectState('dirty', false);

  equal(person, store.find(Person, 2), "the record is now in the store, and can be looked up by ID without another Ajax request");

  people.update();

  expectUrl("/people", "the plural of the model name");
  expectType("GET");
  expectData({since: '1234'});

  ajaxHash.success({ meta: { since: '12345'}, people: [{ id: 3, name: "Dan Gebhardt" }] });

  equal(people.get('length'), 3, 'should have 3 records now');
});

test("meta and since are configurable", function() {
  serializer.configure({
    meta: 'metaObject',
    since: 'sinceToken'
  });

  set(adapter, 'since', 'lastToken');

  people = store.find(Person);

  expectUrl("/people", "the plural of the model name");
  expectType("GET");

  ajaxHash.success({ metaObject: {sinceToken: '123'}, people: [{ id: 1, name: "Yehuda Katz" }] });

  people.update();

  expectUrl("/people", "the plural of the model name");
  expectType("GET");
  expectData({lastToken: '123'});

  ajaxHash.success({ metaObject: {sinceToken: '1234'}, people: [{ id: 2, name: "Paul Chavard" }] });

  person = people.objectAt(1);

  expectState('loaded');
  expectState('dirty', false);

  equal(person, store.find(Person, 2), "the record is now in the store, and can be looked up by ID without another Ajax request");
});

test("finding a person by ID makes a GET to /people/:id", function() {
  person = store.find(Person, 1);

  expectState('loaded', false);
  expectUrl("/people/1", "the plural of the model name with the ID requested");
  expectType("GET");

  ajaxHash.success({ person: { id: 1, name: "Yehuda Katz" } });

  expectState('loaded');
  expectState('dirty', false);

  equal(person, store.find(Person, 1), "the record is now in the store, and can be looked up by ID without another Ajax request");
});

test("finding a person by an ID-alias populates the store", function() {
  person = store.find(Person, 'me');

  expectState('loaded', false);
  expectUrl("/people/me", "the plural of the model name with the ID requested");
  expectType("GET");

  ajaxHash.success({ person: { id: 1, name: "Yehuda Katz" } });

  expectState('loaded');
  expectState('dirty', false);

  equal(person, store.find(Person, 'me'), "the record is now in the store, and can be looked up by the alias without another Ajax request");
});

test("additional data can be sideloaded in a GET", function() {
  group = store.find(Group, 1);

  ajaxHash.success({
    group: {
      id: 1, name: "Group 1", person_ids: [ 1 ]
    },
    people: [{
      id: 1, name: "Yehuda Katz"
    }]
  });

  equal(get(store.find(Person, 1), 'name'), "Yehuda Katz", "the items are sideloaded");
  equal(get(get(store.find(Group, 1), 'people').objectAt(0), 'name'), "Yehuda Katz", "the items are in the relationship");
});

test("finding many people by a list of IDs", function() {
  store.load(Group, { id: 1, person_ids: [ 1, 2, 3 ] });

  var group = store.find(Group, 1);

  equal(ajaxUrl, undefined, "no Ajax calls have been made yet");

  var people = get(group, 'people');

  equal(get(people, 'length'), 3, "there are three people in the relationship already");

  people.forEach(function(person) {
    equal(get(person, 'isLoaded'), false, "the person is being loaded");
  });

  expectUrl("/people");
  expectType("GET");
  expectData({ ids: [ 1, 2, 3 ] });

  ajaxHash.success({
    people: [
      { id: 1, name: "Rein Heinrichs" },
      { id: 2, name: "Tom Dale" },
      { id: 3, name: "Yehuda Katz" }
    ]
  });

  var rein = people.objectAt(0);
  equal(get(rein, 'name'), "Rein Heinrichs");
  equal(get(rein, 'id'), 1);

  var tom = people.objectAt(1);
  equal(get(tom, 'name'), "Tom Dale");
  equal(get(tom, 'id'), 2);

  var yehuda = people.objectAt(2);
  equal(get(yehuda, 'name'), "Yehuda Katz");
  equal(get(yehuda, 'id'), 3);

  people.forEach(function(person) {
    equal(get(person, 'isLoaded'), true, "the person is being loaded");
  });
});

test("finding many people by a list of IDs doesn't rely on the returned array order matching the passed list of ids", function() {
  store.load(Group, { id: 1, person_ids: [ 1, 2, 3 ] });

  var group = store.find(Group, 1);

  var people = get(group, 'people');

  ajaxHash.success({
    people: [
      { id: 2, name: "Tom Dale" },
      { id: 1, name: "Rein Heinrichs" },
      { id: 3, name: "Yehuda Katz" }
    ]
  });

  var rein = people.objectAt(0);
  equal(get(rein, 'name'), "Rein Heinrichs");
  equal(get(rein, 'id'), 1);

  var tom = people.objectAt(1);
  equal(get(tom, 'name'), "Tom Dale");
  equal(get(tom, 'id'), 2);

  var yehuda = people.objectAt(2);
  equal(get(yehuda, 'name'), "Yehuda Katz");
  equal(get(yehuda, 'id'), 3);

});

test("additional data can be sideloaded in a GET with many IDs", function() {
  //store.load(Group, { id: 1, people: [ 1, 2, 3 ] });

  equal(ajaxUrl, undefined, "no Ajax calls have been made yet");

  // findMany is used here even though it is not normally public to test the
  // functionality.
  var groups = store.findMany(Group, [ 1 ]);
  var group = groups.objectAt(0);

  equal(get(group, 'isLoaded'), false, "the group is being loaded");

  expectUrl("/groups");
  expectType("GET");
  expectData({ ids: [ 1 ] });

  ajaxHash.success({
    groups: [
      { id: 1, person_ids: [ 1, 2, 3 ] }
    ],
    people: [
      { id: 1, name: "Rein Heinrichs" },
      { id: 2, name: "Tom Dale" },
      { id: 3, name: "Yehuda Katz" }
    ]
  });

  var people = get(group, 'people');
  equal(get(people, 'length'), 3, "the people have length");

  var rein = people.objectAt(0);
  equal(get(rein, 'name'), "Rein Heinrichs");
  equal(get(rein, 'id'), 1);

  var tom = people.objectAt(1);
  equal(get(tom, 'name'), "Tom Dale");
  equal(get(tom, 'id'), 2);

  var yehuda = people.objectAt(2);
  equal(get(yehuda, 'name'), "Yehuda Katz");
  equal(get(yehuda, 'id'), 3);

  people.forEach(function(person) {
    equal(get(person, 'isLoaded'), true, "the person is being loaded");
  });
});

test("finding people by a query", function() {
  var people = store.find(Person, { page: 1 });

  equal(get(people, 'length'), 0, "there are no people yet, as the query has not returned");

  expectUrl("/people", "the collection at the plural of the model name");
  expectType("GET");
  expectData({ page: 1 });

  ajaxHash.success({
    people: [
      { id: 1, name: "Rein Heinrichs" },
      { id: 2, name: "Tom Dale" },
      { id: 3, name: "Yehuda Katz" }
    ]
  });

  equal(get(people, 'length'), 3, "the people are now loaded");

  var rein = people.objectAt(0);
  equal(get(rein, 'name'), "Rein Heinrichs");
  equal(get(rein, 'id'), 1);

  var tom = people.objectAt(1);
  equal(get(tom, 'name'), "Tom Dale");
  equal(get(tom, 'id'), 2);

  var yehuda = people.objectAt(2);
  equal(get(yehuda, 'name'), "Yehuda Katz");
  equal(get(yehuda, 'id'), 3);

  people.forEach(function(person) {
    equal(get(person, 'isLoaded'), true, "the person is being loaded");
  });
});

test("finding people by a query can sideload data", function() {
  var groups = store.find(Group, { page: 1 });

  equal(get(groups, 'length'), 0, "there are no groups yet, as the query has not returned");

  expectUrl("/groups", "the collection at the plural of the model name");
  expectType("GET");
  expectData({ page: 1 });

  ajaxHash.success({
    groups: [
      { id: 1, name: "Group 1", person_ids: [ 1, 2, 3 ] }
    ],
    people: [
      { id: 1, name: "Rein Heinrichs" },
      { id: 2, name: "Tom Dale" },
      { id: 3, name: "Yehuda Katz" }
    ]
  });

  var group = groups.objectAt(0);
  var people = get(group, 'people');

  equal(get(people, 'length'), 3, "the people are now loaded");

  var rein = people.objectAt(0);
  equal(get(rein, 'name'), "Rein Heinrichs");
  equal(get(rein, 'id'), 1);

  var tom = people.objectAt(1);
  equal(get(tom, 'name'), "Tom Dale");
  equal(get(tom, 'id'), 2);

  var yehuda = people.objectAt(2);
  equal(get(yehuda, 'name'), "Yehuda Katz");
  equal(get(yehuda, 'id'), 3);

  people.forEach(function(person) {
    equal(get(person, 'isLoaded'), true, "the person is being loaded");
  });
});

test("creating several people (with bulkCommit) makes a POST to /people, with a data hash Array", function() {
  set(adapter, 'bulkCommit', true);

  var tom = store.createRecord(Person, { name: "Tom Dale" });
  var yehuda = store.createRecord(Person, { name: "Yehuda Katz" });

  people = [ tom, yehuda ];

  expectStates('new');
  store.commit();
  expectStates('saving');

  expectUrl("/people", "the collection at the plural of the model name");
  expectType("POST");
  expectData({ people: [ { name: "Tom Dale" }, { name: "Yehuda Katz" } ] });

  ajaxHash.success({ people: [ { id: 1, name: "Tom Dale" }, { id: 2, name: "Yehuda Katz" } ] });
  expectStates('saving', false);

  equal(tom, store.find(Person, 1), "it is now possible to retrieve the person by the ID supplied");
  equal(yehuda, store.find(Person, 2), "it is now possible to retrieve the person by the ID supplied");
});

test("bulk commits can sideload data", function() {
  set(adapter, 'bulkCommit', true);

  var tom = store.createRecord(Person, { name: "Tom Dale" });
  var yehuda = store.createRecord(Person, { name: "Yehuda Katz" });

  serializer.configure(Group, { sideloadAs: 'groups' });

  people = [ tom, yehuda ];

  expectStates('new');
  store.commit();
  expectStates('saving');

  expectUrl("/people", "the collection at the plural of the model name");
  expectType("POST");
  expectData({ people: [ { name: "Tom Dale" }, { name: "Yehuda Katz" } ] });

  ajaxHash.success({
    people: [ { id: 1, name: "Tom Dale" }, { id: 2, name: "Yehuda Katz" } ],
    groups: [ { id: 1, name: "Group 1" } ]
  });

  expectStates('saving', false);

  equal(tom, store.find(Person, 1), "it is now possible to retrieve the person by the ID supplied");
  equal(yehuda, store.find(Person, 2), "it is now possible to retrieve the person by the ID supplied");

  group = store.find(Group, 1);
  equal(get(group, 'name'), "Group 1", "the data sideloaded successfully");
});

test("updating several people (with bulkCommit) makes a PUT to /people/bulk with the data hash Array", function() {
  set(adapter, 'bulkCommit', true);

  store.loadMany(Person, [
    { id: 1, name: "Yehuda Katz" },
    { id: 2, name: "Carl Lerche" }
  ]);

  var yehuda = store.find(Person, 1);
  var carl = store.find(Person, 2);

  people = [ yehuda, carl ];

  expectStates('new', false);
  expectStates('loaded');
  expectStates('dirty', false);

  set(yehuda, 'name', "Brohuda Brokatz");
  set(carl, 'name', "Brocarl Brolerche");

  expectStates('dirty');
  store.commit();
  expectStates('saving');

  expectUrl("/people/bulk", "the collection at the plural of the model name");
  expectType("PUT");
  expectData({ people: [{ id: 1, name: "Brohuda Brokatz" }, { id: 2, name: "Brocarl Brolerche" }] });

  ajaxHash.success({ people: [
    { id: 1, name: "Brohuda Brokatz" },
    { id: 2, name: "Brocarl Brolerche" }
  ]});

  expectStates('saving', false);

  equal(yehuda, store.find(Person, 1), "the same person is retrieved by the same ID");
  equal(carl, store.find(Person, 2), "the same person is retrieved by the same ID");
});

test("bulk updates can sideload data", function() {
  set(adapter, 'bulkCommit', true);

  serializer.configure(Group, { sideloadAs: 'groups' });

  store.loadMany(Person, [
    { id: 1, name: "Yehuda Katz" },
    { id: 2, name: "Carl Lerche" }
  ]);

  var yehuda = store.find(Person, 1);
  var carl = store.find(Person, 2);

  people = [ yehuda, carl ];

  expectStates('new', false);
  expectStates('loaded');
  expectStates('dirty', false);

  set(yehuda, 'name', "Brohuda Brokatz");
  set(carl, 'name', "Brocarl Brolerche");

  expectStates('dirty');
  store.commit();
  expectStates('saving');

  expectUrl("/people/bulk", "the collection at the plural of the model name");
  expectType("PUT");
  expectData({ people: [{ id: 1, name: "Brohuda Brokatz" }, { id: 2, name: "Brocarl Brolerche" }] });

  ajaxHash.success({
    people: [
      { id: 1, name: "Brohuda Brokatz" },
      { id: 2, name: "Brocarl Brolerche" }
    ],
    groups: [{ id: 1, name: "Group 1" }]
  });

  expectStates('saving', false);

  equal(yehuda, store.find(Person, 1), "the same person is retrieved by the same ID");
  equal(carl, store.find(Person, 2), "the same person is retrieved by the same ID");

  group = store.find(Group, 1);
  equal(get(group, 'name'), "Group 1", "the data sideloaded successfully");
});

test("deleting several people (with bulkCommit) makes a PUT to /people/bulk", function() {
  set(adapter, 'bulkCommit', true);

  store.loadMany(Person, [
    { id: 1, name: "Yehuda Katz" },
    { id: 2, name: "Carl Lerche" }
  ]);

  var yehuda = store.find(Person, 1);
  var carl = store.find(Person, 2);

  people = [ yehuda, carl ];

  expectStates('new', false);
  expectStates('loaded');
  expectStates('dirty', false);

  yehuda.deleteRecord();
  carl.deleteRecord();

  expectStates('dirty');
  expectStates('deleted');
  store.commit();
  expectStates('saving');

  expectUrl("/people/bulk", "the collection at the plural of the model name with 'delete'");
  expectType("DELETE");
  expectData({ people: [1, 2] });

  ajaxHash.success();

  expectStates('saving', false);
  expectStates('deleted');
  expectStates('dirty', false);
});

test("bulk deletes can sideload data", function() {
  set(adapter, 'bulkCommit', true);

  serializer.configure(Group, { sideloadAs: 'groups' });

  store.loadMany(Person, [
    { id: 1, name: "Yehuda Katz" },
    { id: 2, name: "Carl Lerche" }
  ]);

  var yehuda = store.find(Person, 1);
  var carl = store.find(Person, 2);

  people = [ yehuda, carl ];

  expectStates('new', false);
  expectStates('loaded');
  expectStates('dirty', false);

  yehuda.deleteRecord();
  carl.deleteRecord();

  expectStates('dirty');
  expectStates('deleted');
  store.commit();
  expectStates('saving');

  expectUrl("/people/bulk", "the collection at the plural of the model name with 'delete'");
  expectType("DELETE");
  expectData({ people: [1, 2] });

  ajaxHash.success({
    groups: [{ id: 1, name: "Group 1" }]
  });

  expectStates('saving', false);
  expectStates('deleted');
  expectStates('dirty', false);

  group = store.find(Group, 1);
  equal(get(group, 'name'), "Group 1", "the data sideloaded successfully");
});

test("if you specify a namespace then it is prepended onto all URLs", function() {
  set(adapter, 'namespace', 'ember');
  person = store.find(Person, 1);
  expectUrl("/ember/people/1", "the namespace, followed by the plural of the model name and the id");

  store.load(Person, { id: 1 });
});

test("if you specify a url then that custom url is used", function() {
  set(adapter, 'url', 'http://api.ember.dev');
  person = store.find(Person, 1);
  expectUrl("http://api.ember.dev/people/1", "the custom url, followed by the plural of the model name and the id");

  store.load(Person, { id: 1 });
});

test("sideloaded data is loaded prior to primary data (to ensure relationship coherence)", function() {
  expect(1);

  group = store.find(Group, 1);
  group.then(function(group) {
    equal(group.get('people.firstObject').get('name'), "Tom Dale", "sideloaded data are already loaded");
  });

  ajaxHash.success({
    people: [
      { id: 1, name: "Tom Dale" }
    ],
    group: { id: 1, name: "Tilde team", person_ids: [1] }
  });
});

test("additional data can be sideloaded with relationships in correct order", function() {
  var Comment = DS.Model.extend({
    person: DS.belongsTo(Person)
  });

  serializer.configure(Comment, { sideloadAs: 'comments' });

  var comments = store.filter(Comment, function(data) {
    equal(store.find(Comment, data.get('id')).get('person.id'), 1);
  });

  group = store.find(Group, 1);

  ajaxHash.success({
    group: {
      id: 1, name: "Group 1", person_ids: [ 1 ]
    },
    comments: [{
      id: 1, person_id: 1, text: 'hello'
    }],
    people: [{
      id: 1, name: "Yehuda Katz"
    }]
  });
});

test("data loaded from the server is converted from underscores to camelcase", function() {
  Person.reopen({
    lastName: DS.attr('string')
  });

  store.load(Person, { id: 1, name: "Tom", last_name: "Dale" });

  var person = store.find(Person, 1);

  equal(person.get('name'), "Tom", "precond - data was materialized");
  equal(person.get('lastName'), "Dale", "the attribute name was camelized");
});

test("When a record with a belongsTo is saved the foreign key should be sent.", function () {
  var PersonType = DS.Model.extend({
    title: DS.attr("string"),
    people: DS.hasMany(Person)
  });

  PersonType.toString = function() {
    return "App.PersonType";
  };

  Person.reopen({
    personType: DS.belongsTo(PersonType)
  });

  store.load(PersonType, {id: 1, title: "Developer"});
  var personType = store.find(PersonType, 1);

  var person = store.createRecord(Person, {name: 'Sam Woodard', personType: personType});

  store.commit();

  expectUrl('/people');
  expectType("POST");
  expectData({ person: { name: "Sam Woodard", person_type_id: "1" } });
  ajaxHash.success({ person: { name: 'Sam Woodard', person_type_id: 1}});
});

test("creating a record with a 422 error marks the records as invalid", function(){
  person = store.createRecord(Person, { name: "" });
  store.commit();

  var mockXHR = {
    status:       422,
    responseText: JSON.stringify({ errors: { name: ["can't be blank"]} })
  };

  ajaxHash.error.call(ajaxHash.context, mockXHR);

  expectState('valid', false);
  deepEqual(person.get('errors'), { name: ["can't be blank"]}, "the person has the errors");
});

test("updating a record with a 422 error marks the records as invalid", function(){
  Person.reopen({
    updatedAt: DS.attr('date')
  });
  store.load(Person, { id: 1, name: "John Doe" });
  person = store.find(Person, 1);
  person.set('name', '');
  store.commit();

  var mockXHR = {
    status:       422,
    responseText: JSON.stringify({ errors: { name: ["can't be blank"], updated_at: ["can't be blank"] } })
  };

  ajaxHash.error.call(ajaxHash.context, mockXHR);

  expectState('valid', false);
  deepEqual(person.get('errors'), { name: ["can't be blank"], updatedAt: ["can't be blank"] }, "the person has the errors");
});

test("creating a record with a 500 error marks the record as error", function() {
  person = store.createRecord(Person, { name: "" });
  store.commit();

  var mockXHR = {
    status:       500,
    responseText: 'Internal Server Error'
  };

  ajaxHash.error.call(ajaxHash.context, mockXHR);

  expectState('error');
});

test("updating a record with a 500 error marks the record as error", function() {
  store.load(Person, { id: 1, name: "John Doe" });
  person = store.find(Person, 1);
  person.set('name', 'Jane Doe');
  store.commit();

  var mockXHR = {
    status:       500,
    responseText: 'Internal Server Error'
  };

  ajaxHash.error.call(ajaxHash.context, mockXHR);

  expectState('error');
});
