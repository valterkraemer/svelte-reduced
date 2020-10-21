const sh = require('shelljs');

sh.mkdir('-p', '__sapper__/export/repl/local');
sh.cp('-r', '../compiler.*', '__sapper__/export/repl/local');
sh.cp('-r', '../index.*', '__sapper__/export/repl/local');
sh.cp('-r', '../internal', '__sapper__/export/repl/local');
