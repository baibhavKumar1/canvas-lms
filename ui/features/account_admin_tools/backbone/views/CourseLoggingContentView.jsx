//
// Copyright (C) 2014 - present Instructure, Inc.
//
// This file is part of Canvas.
//
// Canvas is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, version 3 of the License.
//
// Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
// A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
// details.
//
// You should have received a copy of the GNU Affero General Public License along
// with this program. If not, see <http://www.gnu.org/licenses/>.

import React from 'react'
import {createRoot} from 'react-dom/client'
import Backbone from '@canvas/backbone'
import $ from 'jquery'
import PaginatedCollectionView from '@canvas/pagination/backbone/views/PaginatedCollectionView'
import DateRangeSearchView from './DateRangeSearchView'
import AutocompleteView from './AutocompleteView'
import ValidatedMixin from '@canvas/forms/backbone/views/ValidatedMixin'
import CourseLoggingItemView from './CourseLoggingItemView'
import CourseLoggingCollection from '../collections/CourseLoggingCollection'
import template from '../../jst/courseLoggingContent.handlebars'
import courseLoggingResultsTemplate from '../../jst/courseLoggingResults.handlebars'
import {extend} from '@canvas/backbone/utils'
import CourseActivityDetails from '../../react/CourseActivityDetails'

extend(CourseLoggingContentView, Backbone.View)

export default function CourseLoggingContentView(options) {
  this.fetch = this.fetch.bind(this)
  this.onFail = this.onFail.bind(this)
  this.options = options
  this.collection = new CourseLoggingCollection()
  Backbone.View.apply(this, arguments)
  this.dateRangeSearch = new DateRangeSearchView({
    name: 'courseLogging',
  })
  this.courseSearch = new AutocompleteView({
    collection: new Backbone.Collection(null, {resourceName: 'courses'}),
    labelProperty: $.proxy(this.autoCompleteItemLabel, this),
    fieldName: 'course_id',
    placeholder: 'Course ID',
    sourceParameters: {
      'state[]': 'all',
    },
  })
  this.resultsView = new PaginatedCollectionView({
    template: courseLoggingResultsTemplate,
    itemView: CourseLoggingItemView,
    collection: this.collection,
  })
}
CourseLoggingContentView.mixin(ValidatedMixin)
CourseLoggingContentView.child('resultsView', '#courseLoggingSearchResults')
CourseLoggingContentView.child('dateRangeSearch', '#courseDateRangeSearch')
CourseLoggingContentView.child('courseSearch', '#courseCourseSearch')

Object.assign(CourseLoggingContentView.prototype, {
  fieldSelectors: {course_id: '#course_id-autocompleteField'},

  els: {'#courseLoggingForm': '$form'},

  template,

  events: {
    'submit #courseLoggingForm': 'onSubmit',
    'click #courseLoggingSearchResults .courseLoggingDetails > a': 'showDetails',
  },

  onSubmit(event) {
    event.preventDefault()
    const json = this.$form.toJSON()
    if (this.validate(json)) {
      return this.updateCollection(json)
    }
  },

  showDetails(event) {
    event.preventDefault()
    const $target = $(event.target)
    const id = $target.data('id')

    const model = this.collection.get(id)
    if (model === null || typeof model === 'undefined') {
      // eslint-disable-next-line no-console
      console.warn(`Could not find model for event ${id}.`)
      return
    }

    const type = model.get('event_type')
    if (type === null || typeof type === 'undefined') {
      // eslint-disable-next-line no-console
      console.warn(`Could not find type for event ${id}.`)
      return
    }

    const mountPoint = document.getElementById('course_activity_details_mount_point')
    const root = createRoot(mountPoint)

    root.render(<CourseActivityDetails {...model.present()} onClose={() => root.unmount()} />)
  },

  updateCollection(json) {
    // Update the params (which fetches the collection)
    if (!json) json = this.$form.toJSON()

    const params = {
      id: null,
      type: null,
      start_time: '',
      end_time: '',
    }

    if (json.start_time) params.start_time = json.start_time
    if (json.end_time) params.end_time = json.end_time

    if (json.course_id) params.id = json.course_id

    return this.collection.setParams(params)
  },

  validate(json) {
    if (!json) json = this.$form.toJSON()
    delete json.course_submit
    const errors = this.dateRangeSearch.validate(json) || {}

    if (!json.course_id) json.course_id = this.$el.find('#course_id-autocompleteField').val()
    if (!json.course_id) {
      errors.course_submit = [
        {
          type: 'required',
          message: 'A valid Course is required to search events.',
        },
      ]
    }

    this.showErrors(errors)
    return $.isEmptyObject(errors)
  },

  attach() {
    return this.collection.on('setParams', this.fetch)
  },

  fetch() {
    return this.collection.fetch({error: this.onFail})
  },

  onFail(_collection, xhr) {
    // Received a 404, empty the collection and don't let the paginated
    // view try to fetch more.
    this.collection.reset()
    this.resultsView.detachScroll()
    this.resultsView.$el.find('.paginatedLoadingIndicator').fadeOut()

    if ((xhr != null ? xhr.status : undefined) != null && xhr.status === 404) {
      const errors = {}
      errors.course_id = [
        {
          type: 'required',
          message: 'A course with that ID could not be found for this account.',
        },
      ]
      if (!$.isEmptyObject(errors)) return this.showErrors(errors)
    }
  },

  autoCompleteItemLabel(model) {
    const name = model.get('name')
    const code = model.get('course_code')
    return `${model.id} - ${name} - ${code}`
  },
})
