const Diffable = require('./diffable')
const NopCommand = require('../nopcommand')
const previewHeaders = { accept: 'application/vnd.github.symmetra-preview+json' }

module.exports = class Labels extends Diffable {
  constructor (...args) {
    super(...args)

    if (this.entries) {
      this.entries.forEach(label => {
        // Force color to string since some hex colors can be numerical (e.g. 999999)
        if (label.color) {
          label.color = String(label.color).replace(/^#/, '')
          if (label.color.length < 6) {
            label.color.padStart(6, '0')
          }
        }
      })
    }
  }
  
  static canOverride(target, source) {
    return true
  }

  static canOverrideStr(target, source) {
    return ``
  }

  find () {
    this.log.debug(`Finding labels for ${JSON.stringify(this.wrapAttrs({ per_page: 100 }))}`)
    const options = this.github.issues.listLabelsForRepo.endpoint.merge(this.wrapAttrs({ per_page: 100 }))
    return this.github.repos.get(this.repo).then(() => { 
      return this.github.paginate(options)
    })
    .catch(e => {
      this.log.error(` Error ${JSON.stringify(e)}`)
      if (e.status === 404) {
        return Promise.resolve([])
      }
    })
  }

  comparator (existing, attrs) {
    return existing.name === attrs.name || existing.name === attrs.oldname || existing.name === attrs.current_name
  }

  changed (existing, attrs) {
    return attrs.oldname === existing.name || existing.color !== attrs.color || existing.description !== attrs.description
  }

  update (existing, attrs) {
    // Our settings file uses oldname for renaming labels,
    // however octokit/rest 16.30.1 uses the current_name attribute.
    // Future versions of octokit/rest will need name and new_name attrs.
    this.log.debug(`Updating labels for ${JSON.stringify(attrs,null,4)}   ${JSON.stringify(this.repo,null,4)}`)
    attrs.current_name = attrs.oldname || attrs.name
    delete attrs.oldname
    if (this.nop) {
      return Promise.resolve([
        new NopCommand(this.constructor.name, this.repo, this.github.issues.updateLabel.endpoint(this.wrapAttrs(attrs)),"Update label"),
      ])
    }
    return this.github.issues.updateLabel(this.wrapAttrs(attrs))
  }

  add (attrs) {
    if (this.nop) {
      return Promise.resolve([
        new NopCommand(this.constructor.name, this.repo, this.github.issues.createLabel.endpoint(this.wrapAttrs(attrs)),"Create label"),
      ])
    }
    this.log.debug(`Creating labels for ${JSON.stringify(attrs,null,4)}`)
    return this.github.issues.createLabel(this.wrapAttrs(attrs)).catch(e => this.log.error(` ${JSON.stringify(e)}`))
  }

  remove (existing) {
    if (this.nop) {
      return Promise.resolve([
        new NopCommand(this.constructor.name, this.repo, this.github.issues.deleteLabel.endpoint(this.wrapAttrs({ name: existing.name })),"Delete label"),
      ])
    }
    return this.github.issues.deleteLabel(this.wrapAttrs({ name: existing.name }))
  }

  wrapAttrs (attrs) {
    return Object.assign({}, attrs, this.repo, { headers: previewHeaders })
  }
}
