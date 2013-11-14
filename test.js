var domBuilder = require('dombuilder');
var jsGithub = require('./src/repo.js');
var getMime = require('simple-mime')('application/octet-stream');

var accessToken = localStorage.getItem("accessToken");
if (!accessToken) {
  accessToken = prompt("Enter access token");
  if (!accessToken) throw new Error("Aborted by user");
  localStorage.setItem("accessToken", accessToken);
}

var $ = {};
document.body.textContent = "";
document.body.appendChild(domBuilder([
  ["nav", ["ul$0"]],
  ["nav", ["ul$1"]],
  ["nav", ["ul$2"]],
  ["nav", ["ul$3"]],
  [".body$4"]
], $));

renderRepos([
  jsGithub("creationix/conquest", accessToken),
  jsGithub("creationix/exploder", accessToken),
  jsGithub("creationix/js-github", accessToken),
  jsGithub("creationix/js-git", accessToken),
  jsGithub("creationix/dombuilder", accessToken),
  jsGithub("creationix/simple-mime", accessToken),
  jsGithub("creationix/luv", accessToken),
  jsGithub("luvit/luvit", accessToken),
  jsGithub("joyent/node", accessToken),
  jsGithub("joyent/libuv", accessToken),
]);

function renderRepos(repos) {
  fixedList(0, repos, function (repo) {
    repo.onCommitStream = onCommitStream.bind(repo);
    repo.onRefs = onRefs.bind(repo);
    return ["li.row", repo.name];
  }, function (repo) {
    repo.listRefs("", repo.onRefs);
  });
}

function onRefs(err, refs) {
  if (err) throw err;
  var repo = this;
  var names = Object.keys(refs);
  names.unshift("HEAD");
  refs.HEAD = "HEAD";
  fixedList(1, names, function (name) {
    return ["li.row", {title: refs[name]}, name];
  }, function (name) {
    repo.logWalk(refs[name], repo.onCommitStream);
  });
}

function onCommitStream(err, commitStream) {
  if (err) throw err;
  var repo = this;

  dynamicList(2, commitStream, function (commit) {
    var title = commit.hash +
         "\n" + commit.author.name + " - " + commit.author.date.toString() +
         "\n" + commit.message;
    return ["li.row", {title: title },
      [".message", commit.message.split("\n")[0]],
      [".date", commit.author.date.toDateString()],
    ];
  }, function onClick(commit) {
    repo.treeWalk(commit.tree, onFileStream);
  });
}

function onFileStream(err, fileStream) {
  if (err) throw err;

  dynamicList(3, fileStream, function (entry) {
    if (entry.type !== "blob") return;
    return ["li.row", {title: entry.hash}, entry.path ];
  }, function onClick(entry) {
    clear(4);
    var mime = getMime(entry.name);
    if (/^image\//.test(mime)) return showBinary(entry, mime);
    var isText = true;
    var text = "";
    for (var i = 0, l = entry.body.length; i < l; i++) {
      var byte = entry.body[i];
      if (entry.body[i] & 0x80) {
        isText = false;
        break;
      }
      text += String.fromCharCode(byte);
    }
    if (isText) return showText(entry, text);
    showBinary(entry, mime);
  });
}

function clear(index) {
  while (index <= 4) $[index++].textContent = "";
}

function showText(entry, text) {
  $[4].appendChild(domBuilder([
    ["pre", ["textarea.fill", text]]
  ]));
}

function showBinary(entry, mime) {
  var blob = new Blob([entry.body], {type: mime});
  var url = window.URL.createObjectURL(blob);
  $.body.appendChild(domBuilder(
    ["img", {src:url}]
  ));
}

function fixedList(index, list, formatter, onclick) {
  var selected = null;
  var ul = $[index];
  clear(index);
  list.forEach(function (item) {
    var child = domBuilder(formatter(item));
    child.onclick = function (evt) {
      evt.preventDefault();
      evt.stopPropagation();
      if (selected) selected.classList.remove("selected");
      selected = child;
      selected.classList.add("selected");
      onclick(item);
    };
    ul.appendChild(child);
  });
}

function dynamicList(index, stream, formatter, onclick) {
  var ul = $[index];
  clear(index);
  var container = ul.parentElement;
  var selected = null;
  container.onscroll = onScroll;
  var bottom = 0;
  var height = container.offsetHeight + container.scrollTop;
  var loading = false;
  check();

  function onRead(err, item) {
    loading = false;
    if (err) throw err;
    if (!item) return;
    var json = formatter(item);
    if (!json) return stream.read(onRead);
    var child = domBuilder(json);
    child.onclick = function (evt) {
      evt.preventDefault();
      evt.stopPropagation();
      if (selected) selected.classList.remove("selected");
      selected = child;
      selected.classList.add("selected");
      onclick(item);
    };
    ul.appendChild(child);
    bottom = child.offsetTop + child.offsetHeight;
    check();
  }

  function onScroll() {
    height = container.offsetHeight + container.scrollTop;
    check();
  }

  function check() {
    if (loading || (bottom > height)) return;
    loading = true;
    stream.read(onRead);
  }

}