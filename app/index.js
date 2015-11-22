'use strict';
var yeoman = require('yeoman-generator');
var chalk = require('chalk');
var fs = require('fs');
var inspect = require('eyes').inspector({maxLength: false});
var ncp = require('ncp').ncp;
var path = require('path');
var rmdir = require('rmdir');
var semver = require('semver');
var versions = require('./dependency-versions.js');
var yosay = require('yosay');
var _ = require('lodash');

// and yeah

module.exports = yeoman.generators.Base.extend({
  initializing: function () {
    this.out = require('./app-output.js')(this);
    this.pkg = require('../package.json');
    this.config.set('generatorVersion', this.pkg.version);
    this.sdkVersions = require("./sdk-versions.js");
    this.config.defaults({
      sdkVersion: '2.1.1',
      projectGroupId: 'org.alfresco',
      projectArtifactId: 'demoamp',
      projectVersion: '1.0.0-SNAPSHOT',
      projectPackage: 'org.alfresco',
      communityOrEnterprise: 'Community',
      includeGitIgnore: true,
      removeSamples: true,
    });
    try {
      this.javaVersion = versions.getJavaVersion();
      if (!this.javaVersion) {
        throw new Error('We are unable to find a java executable. A compatible version of java is required.');
      }
      this.mavenVersion = versions.getMavenVersion();
      if (!this.mavenVersion) {
        throw new Error('We are unable to find a maven executable. A compatible version of maven is required.');
      }
    } catch (e) {
      this.out.error(e.message);
      throw e;
    }
    this.moduleRegistry = require('./alfresco-module-registry.js')(this);
  },

  prompting: function () {
    // Have Yeoman greet the user.
    this.log(yosay(
      'Welcome to the ' + chalk.green('Alfresco') + ' generator!'
    ));

    var prompts = [
      {
        type: 'list',
        name: 'sdkVersion',
        message: 'Which SDK version would you like to use?',
        default: this.config.get('sdkVersion'),
        choices: _.keys(this.sdkVersions),
      },
      {
        type: 'input',
        name: 'archetypeVersion',
        message: 'Archetype version?',
        default: function(props) {
          var savedArchetypeVersion = this.config.get('archetypeVersion');
          if (savedArchetypeVersion) return savedArchetypeVersion;
          return this.sdk.archetypeVersion;
        }.bind(this),
        when: function(props) {
          this.sdk = this.sdkVersions[props.sdkVersion];
          if (this.sdk.promptForArchetypeVersion) {
            return true;
          } else {
            // if we don't prompt then save the version anyway
            props['archetypeVersion'] = this.sdk.archetypeVersion;
            return false;
          }
        }.bind(this),
      },
      {
        type: 'input',
        name: 'projectGroupId',
        message: 'Project groupId?',
        default: this.config.get('projectGroupId'),
      },
      {
        type: 'input',
        name: 'projectArtifactId',
        message: 'Project artifactId?',
        default: this.config.get('projectArtifactId'),
      },
      {
        type: 'input',
        name: 'projectVersion',
        message: 'Project version?',
        default: this.config.get('projectVersion'),
      },
      {
        type: 'input',
        name: 'projectPackage',
        message: 'Project package?',
        default: function(props) {
          return props.projectGroupId
        }.bind(this),
        when: function(props) {
          this.sdk = this.sdkVersions[props.sdkVersion];
          return this.sdk.promptForProjectPackage;
        }.bind(this),
      },
      {
        type: 'list',
        name: 'communityOrEnterprise',
        message: 'Would you like to use Community or Enterprise?',
        default: this.config.get('communityOrEnterprise'),
        choices: ['Community', 'Enterprise'],
      },
      {
        type: 'confirm',
        name: 'includeGitIgnore',
        message: 'Should we generate a default .gitignore file?',
        default: this.config.get('includeGitIgnore'),
      },
      {
        type: 'confirm',
        name: 'removeSamples',
        message: 'Should we remove samples from default source amps?',
        default: this.config.get('removeSamples'),
        when: function(props) {
          this.sdk = this.sdkVersions[props.sdkVersion];
          props['removeSamples'] = (true && this.sdk.removeSamplesScript);
          return props['removeSamples'];
        }.bind(this),
      },
    ];

    var donePrompting = this.async();
    this.prompt(prompts, function (props) {
      this.sdk = this.sdkVersions[props.sdkVersion];
      this._saveProps([
        'sdkVersion',
        'archetypeVersion',
        'projectGroupId',
        'projectArtifactId',
        'projectVersion',
        'projectPackage',
        'communityOrEnterprise',
        'includeGitIgnore',
        'removeSamples',
      ], props);
      donePrompting();
    }.bind(this));
  },

  _saveProp: function(propName, propObject) {
    var value = propObject[propName];
    this[propName] = value;
    this.config.set(propName, value);
  },

  _saveProps: function(propNames, propObject) {
    propNames.forEach(function(propName) {
      this._saveProp(propName, propObject);
    }.bind(this));
  },

  configuring: {
    saveConfig: function () {
      this.config.save();
    },
  },

  default: {
    checkVersions: function () {
      try {
        if (!semver.satisfies(this.javaVersion.replace(/_[0-9]+$/, ''), this.sdk.supportedJavaVersions)) {
          throw new Error('Unfortunately the current version of java (' + this.javaVersion + ') ' +
              'does not match one of the supported versions: ' + this.sdk.supportedJavaVersions + ' ' +
              'for the SDK you have selected (' + this.archetypeVersion + '). ' +
              'Either set JAVA_HOME to point to a valid version of java or install one.');
        }
        if (!semver.satisfies(this.mavenVersion, this.sdk.supportedMavenVersions)) {
          throw new Error('Unfortunately the current version of maven (' + this.mavenVersion + ') ' +
              'does not match one of the supported versions: ' + this.sdk.supportedMavenVersions + ' ' +
              'for the SDK you have selected (' + this.archetypeVersion + '). ' +
              'Please install a supported version.');
        }
      } catch (e) {
        this.out.error(e.message);
        throw e;
      }
    },
    saveDefaultModulesInRegistry: function() {
      this.moduleRegistry.addModule(this.projectGroupId, 'repo-amp', this.projectVersion, 'amp', 'repo', 'source', 'repo-amp');
      this.moduleRegistry.addModule(this.projectGroupId, 'share-amp', this.projectVersion, 'amp', 'share', 'source', 'share-amp');
      this.moduleRegistry.save();
    },
  },

  writing: {
    generateArchetype: function () {
      var done = this.async();

      this.out.info('Attempting to use maven and the ' + this.archetypeVersion + ' all-in-one archetype to setup your project.');

      var cwd = process.cwd();

      var tmpDir = path.join(cwd, 'tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir);
      }
      process.chdir(tmpDir);

      var cmd = 'mvn';
      var args = [
        'archetype:generate',
        '-DinteractiveMode=false',
        '-DarchetypeGroupId=' + this.sdk.archetypeGroupId,
        '-DarchetypeArtifactId=' + this.sdk.archetypeArtifactId,
        '-DarchetypeVersion=' + this.archetypeVersion,
        '-DgroupId=' + this.projectGroupId,
        '-DartifactId=' + this.projectArtifactId,
        '-Dversion=' + this.projectVersion,
      ];
      if (undefined !== this.sdk.archetypeCatalog) {
        args.push('-DarchetypeCatalog=' + this.sdk.archetypeCatalog);
      }
      if (undefined !== this.projectPackage) {
        args.push('-Dpackage=' + this.projectPackage);
      }
      var proc = this.spawnCommand(cmd, args);

      // Once mvn completes move stuff up a level
      proc.on('exit', function(code, signal) {
        this.out.info('Maven completed, processing files generated by archetype');
        process.chdir(cwd); // restore current working directory
        var genDir = path.join(tmpDir, this.projectArtifactId);
        var sdkContents = fs.readdirSync(genDir);
        sdkContents.forEach(function(fileOrFolder) {
          this.fs.copy(
            path.join(genDir, fileOrFolder),
            this.destinationPath(fileOrFolder)
          );
        }.bind(this));
        rmdir(tmpDir, function (err, dir, files) {
          // nothing to do here
        }.bind(this));
        done();
      }.bind(this));
    },
    editGeneratedResources: function() {
      // Arrange for all generated beans to be included
      var moduleContextPath = 'repo-amp/src/main/amp/config/alfresco/module/repo-amp/module-context.xml';
      var importPath = 'classpath:alfresco/module/${project.artifactId}/context/generated/*-context.xml';

      var contextDocOrig = this.fs.read(this.destinationPath(moduleContextPath));
      var context = require('./spring-context.js')(contextDocOrig);
      if (!context.hasImport(importPath)) {
        context.addImport(importPath);
        var contextDocNew = context.getContextString();
        this.fs.write(moduleContextPath, contextDocNew);
      }
    },
    generatorOverlay: function () {
      var isEnterprise = ('Enterprise' === this.communityOrEnterprise);
      var tplContext = {
        isEnterprise: isEnterprise,
        enterpriseFlag: (isEnterprise ? '-Penterprise' : '')
      };
      this.fs.copy(
        this.templatePath('editorconfig'),
        this.destinationPath('.editorconfig')
      );
      if (this.includeGitIgnore) {
        this.fs.copy(
          this.templatePath('gitignore'),
          this.destinationPath('.gitignore')
        );
      }
      this.fs.copyTpl(
        this.templatePath('TODO.md'),
        this.destinationPath('TODO.md'),
        tplContext
      );
      // copy folders
      ['amps', 'amps_share', 'amps_source', 'amps_source_templates', 'repo-amp', 'scripts'].forEach(
        function(folderName) {
          this.out.info('Copying ' + folderName);
          this.fs.copyTpl(
            this.templatePath(folderName),
            this.destinationPath(folderName),
            tplContext
            );
        }.bind(this)
      );
      // copy run.sh to top level folder
      this.fs.copy(
        this.destinationPath('scripts/run.sh'),
        this.destinationPath('run.sh')
      );
      // enterprise specific stuff
      if (isEnterprise) {
        this.fs.copy(
          this.templatePath('repo'),
          this.destinationPath('repo'),
          tplContext);
      }
    },
    removeSamplesScript: function () {
      if (this.removeSamples) {
        this.sdk.removeSamplesScript.call(this);
      }
    }
  },

  install: {
    saveAMPSourceTemplates: function() {
      var folders = ['repo-amp', 'share-amp'];
      var done;
      // Need to increment async count for each ncp we plan to run
      folders.forEach(function(folderName) {
        done = this.async();
      }.bind(this));
      this.out.info('Attempting to backup generated amp templates');
      ncp.limit = 16;
      folders.forEach(
        function(folderName) {
          if (fs.existsSync(this.destinationPath('amps_source_templates/' + folderName))) {
            this.out.warn(folderName + " template already copied, not re-copying");
          } else {
            ncp(
              this.destinationPath(folderName),
              this.destinationPath('amps_source_templates/' + folderName),
              function(err) {
                if (err) {
                  this.out.error(err);
                }
                done();
              }.bind(this)
            );
          }
        }.bind(this)
      );
    },
    makeRunExecutable: function () {
      var cwd = process.cwd();
      var scripts = [
        'run.sh',
        'scripts/debug.sh',
        'scripts/explode-alf-sources.sh',
        'scripts/find-exploded.sh',
        'scripts/grep-exploded.sh',
        'scripts/package-to-exploded.sh',
        'scripts/run.sh'
      ];
      scripts.forEach(function(scriptName) {
        fs.chmod(cwd + '/' + scriptName, '0755', function(err) {
          if (err) {
            this.out.error(err);
          } else {
            this.out.info('Marking ' + scriptName + ' as executable');
          }
        }.bind(this));
      }.bind(this));
    }
  },

});

// vim: autoindent expandtab tabstop=2 shiftwidth=2 softtabstop=2
