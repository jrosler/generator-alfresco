'use strict';

var path = require('path');
var assert = require('yeoman-generator').assert;
var helpers = require('yeoman-generator').test;
var os = require('os');

describe('alfresco:app', function () {

  this.timeout(20000);

  before(function (done) {
    helpers.run(path.join(__dirname, '../app'))
      .inDir(path.join(os.tmpdir(), './temp-test'))
      .withOptions({ 'skip-install': true })
      .withPrompt({
        someOption: true
      })
      .on('end', done);
  });

  it('creates files', function () {
    // TODO(bwavell): add more tests
    assert.file([
      '.editorconfig',
      '.yo-rc.json',
      'pom.xml',
      'run.sh',
      'amps/README.md',
      'amps_share/README.md',
      'amps_source/README.md',
      'repo/pom.xml',
      'repo-amp/pom.xml',
      'runner/pom.xml',
      'share/pom.xml',
      'share-amp/pom.xml',
      'solr/pom.xml',
      'repo-amp/src/main/amp/config/alfresco/module/repo-amp/context/generated/README.md',
    ]);
  });
  it('adds generic include for generated beans', function () {
    assert.fileContent(
      'repo-amp/src/main/amp/config/alfresco/module/repo-amp/module-context.xml',
      /<import resource="classpath:alfresco\/module\/\${project\.artifactId}\/context\/generated\/\*-context\.xml"\/>/
    );
  });
});
