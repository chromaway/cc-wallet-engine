module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    browserify: {
      production: {
        src: ['src/index.js'],
        dest: 'cc-wallet-engine.js',
        options: {
          browserifyOptions: {
            standalone: 'ccWalletEngine'
          }
        }
      },
      test: {
        src: ['test/*.js'],
        dest: 'cc-wallet-engine.test.js'
      }
    },
    clean: {
      builds: {
        src: ['cc-wallet-engine.js', 'cc-wallet-engine.min.js', 'cc-wallet-engine.test.js']
      }
    },
    jshint: {
      src: ['Gruntfile.js', 'src', 'test'],
      options: {
        jshintrc: true,
        reporter: require('jshint-stylish')
      }
    },
    jscs: {
      src: ['Gruntfile.js', 'src/*.js', 'test/*.js'],
      options: {
        config: '.jscsrc'
      }
    },
    mocha_istanbul: {
      coverage: {
        src: 'test',
        options: {
          mask: '*.js',
          reporter: 'spec',
          timeout: 60000
        }
      },
      coveralls: {
        src: 'test',
        options: {
          coverage: true,
          mask: '*.js',
          reporter: 'spec',
          timeout: 60000
        }
      }
    },
    mochaTest: {
      test: {
        options: {
          reporter: 'spec',
          timeout: 60000
        },
        src: ['test/*.js']
      }
    },
    uglify: {
      production: {
        files: {
          'cc-wallet-engine.min.js': 'cc-wallet-engine.js'
        }
      }
    },
    watch: {
      configFiles: {
        files: ['Gruntfile.js'],
        options: {
          reload: true
        }
      },
      src: {
        files: ['src/**.js', 'test/*.js'],
        tasks: ['jshint', 'coverage']
      }
    }
  })

  grunt.event.on('coverage', function (lcov, done) {
    require('coveralls').handleInput(lcov, function (error) {
      if (error && !(error instanceof Error)) {
        error = new Error(error)
      }

      done(error)
    })
  })

  grunt.loadNpmTasks('grunt-browserify')
  grunt.loadNpmTasks('grunt-contrib-clean')
  grunt.loadNpmTasks('grunt-contrib-jshint')
  grunt.loadNpmTasks('grunt-contrib-uglify')
  grunt.loadNpmTasks('grunt-contrib-watch')
  grunt.loadNpmTasks('grunt-mocha-istanbul')
  grunt.loadNpmTasks('grunt-jscs')
  grunt.loadNpmTasks('grunt-mocha-test')

  grunt.registerTask('compile', ['browserify:production', 'uglify:production'])
  grunt.registerTask('compile_test', ['browserify:test'])
  grunt.registerTask('coverage', ['mocha_istanbul:coverage'])
  grunt.registerTask('coveralls', ['mocha_istanbul:coveralls'])
  grunt.registerTask('test', ['mochaTest'])
}
