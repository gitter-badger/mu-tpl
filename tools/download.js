'use strict'
const path = require('path')
const ora = require('ora')
const exists = require('fs').existsSync
const rm = require('rimraf').sync
const downloadGitRepo = require('download-git-repo')
const logger = require('./logger')
const async = require('async')
const render = require('consolidate').handlebars.render
const Metalsmith = require('metalsmith')
const exec = require('child_process').exec

class Download {
  constructor () {
    this.visions = '0.0.1'
  }
  getTemplateRepo (url) {
    let index = url.indexOf(':')
    let repo = url.substr(0, index)
    let uri = url.substr(index + 1, url.length)
    let obj = {
      repo: repo,
      uri: uri,
      url: url,
      clone: repo === 'gitlab'
    }
    return obj
  }
  getTemplatePath (templatePath) {
    return path.isAbsolute(templatePath)
      ? templatePath
      : path.normalize(path.join(process.cwd(), templatePath))
  }
  getTemplate (info, tmp, done) {
    let spinner = ora('downloading template(正在下载模板中) ...')
    spinner.start()
    if (exists(tmp)) rm(tmp)
    downloadGitRepo(info.url, tmp, { clone: info.clone }, function (err) {
      spinner.stop()
      if (err) logger.error('Failed to download repo ' + info.url + ' (下载模板失败): ' + err.message.trim())
      logger.successd('Successd to download repo ' + info.url + ' (下载模板成功)!')
      done()
    })
  }
  getTemplateFiles () {
    return function (files, metalsmith, done) {
      let keys = Object.keys(files)
      let metalsmithMetadata = metalsmith.metadata()
      async.each(keys, function (file, next) {
        var str = files[file].contents.toString()
        if (!/{{([^{}]+)}}/g.test(str)) {
          return next()
        }
        render(str, metalsmithMetadata, function (err, res) {
          if (err) {
            err.message = `[${file}] ${err.message}`
            return next(err)
          }
          files[file].contents = Buffer.from(res)
          next()
        })
      }, done)
    }
  }
  moveLocalFiles (obj) {
    let that = this
    Metalsmith('.')
    .metadata(obj.metadata)
    .source(obj.src)
    .destination(obj.dest)
    .clean(false)
    .use(that.getTemplateFiles())
    .build(function (err, files) {
      if (err) logger.error(err)
      for (let file of obj.del) {
        rm('./' + obj.dest + '/' + file)
      }
      logger.successd('Success to Generate project(成功生成项目)!')
      // 自动安装npm
      if (obj.auto) {
        that.autoInstall(obj.dest)
      }
    })
  }
  autoInstall (projectName) {
    let spinner = ora('Auto npm install(自动安装依赖中) ...')
    spinner.start()
    let cmdStr = 'cd ' + projectName + ' && npm i'
    exec(cmdStr, (err, stdout, stderr) => {
      spinner.stop()
      if (err) logger.error(err)
      logger.successd('Successd to npm install(依赖安装成功)!')
    })
  }
}
const download = new Download()
module.exports = download
