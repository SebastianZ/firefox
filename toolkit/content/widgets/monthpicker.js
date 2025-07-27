/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* import-globals-from datekeeper.js */
/* import-globals-from calendar.js */
/* import-globals-from spinner.js */

"use strict";

/**
 * MonthYear is a component that handles the month & year spinners
 *
 * @param {Object} options
 *        {
 *          {String} locale
 *          {Function} setYear
 *          {Function} setMonth
 *          {Function} getMonthString
 *          {Array<String>} datetimeOrders
 *        }
 * @param {DOMElement} context
 */
class MonthYear {
  constructor(options, context) {
    const spinnerSize = 5;
    const yearFormat = new Intl.DateTimeFormat(options.locale, {
      year: "numeric",
      timeZone: "UTC",
    }).format;
    const dateFormat = new Intl.DateTimeFormat(options.locale, {
      year: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format;
    const spinnerOrder = options.datetimeOrders.indexOf("month") <
      options.datetimeOrders.indexOf("year")
      ? "order-month-year"
      : "order-year-month";

    context.monthYearView.classList.add(spinnerOrder);

    this.context = context;
    this.state = { dateFormat };
    this.props = {};
    this.components = {
      month: new Spinner(
        {
          id: "spinner-month",
          setValue: month => {
            this.state.isMonthSet = true;
            options.setMonth(month);
          },
          getDisplayString: options.getMonthString,
          viewportSize: spinnerSize,
        },
        context.monthYearView
      ),
      year: new Spinner(
        {
          id: "spinner-year",
          setValue: year => {
            this.state.isYearSet = true;
            options.setYear(year);
          },
          getDisplayString: year => yearFormat(new Date(new Date(0).setUTCFullYear(year))),
          viewportSize: spinnerSize,
        },
        context.monthYearView
      ),
    };

    this._updateButtonLabels();
    this._attachEventListeners();
  }
  /**
   * Set new properties and pass them to components
   *
   * @param {Object} props
   *        {
   *          {Boolean} isVisible
   *          {Date} dateObj
   *          {Array<Object>} months
   *          {Array<Object>} years
   *          {Function} toggleMonthPicker
   *         }
   */
  setProps(props) {
    this.context.monthYear.textContent = this.state.dateFormat(props.dateObj);
    const spinnerDialog = this.context.monthYearView.parentNode;

    if (props.isVisible) {
      this.context.monthYear.classList.add("active");
      this.context.monthYear.setAttribute("aria-expanded", "true");
      // To prevent redundancy, as spinners will announce their value on change
      this.context.monthYear.setAttribute("aria-live", "off");
      this.components.month.setState({
        value: props.dateObj.getUTCMonth(),
        items: props.months,
        isInfiniteScroll: true,
        isValueSet: this.state.isMonthSet,
        smoothScroll: !(this.state.firstOpened || props.noSmoothScroll),
      });
      this.components.year.setState({
        value: props.dateObj.getUTCFullYear(),
        items: props.years,
        isInfiniteScroll: false,
        isValueSet: this.state.isYearSet,
        smoothScroll: !(this.state.firstOpened || props.noSmoothScroll),
      });
      this.state.firstOpened = false;

      // Set up spinner dialog container properties for assistive technology:
      spinnerDialog.setAttribute("role", "dialog");
      spinnerDialog.setAttribute("aria-modal", "true");
    } else {
      this.context.monthYear.classList.remove("active");
      this.context.monthYear.setAttribute("aria-expanded", "false");
      // To ensure calendar month's changes are announced:
      this.context.monthYear.setAttribute("aria-live", "polite");
      // Remove spinner dialog container properties to ensure this hidden
      // modal will be ignored by assistive technology, because even though
      // the dialog is hidden, the toggle button is a visible descendant,
      // so we must not treat its container as a dialog:
      spinnerDialog.removeAttribute("role");
      spinnerDialog.removeAttribute("aria-modal");
      this.state.isMonthSet = false;
      this.state.isYearSet = false;
      this.state.firstOpened = true;
    }

    this.props = Object.assign(this.props, props);
  }

  /**
   * Handle events
   * @param  {DOMEvent} event
   */
  handleEvent(event) {
    switch (event.type) {
      case "click": {
        this.props.toggleMonthPicker();
        break;
      }
      case "keydown": {
        if (event.key === "Enter" || event.key === " ") {
          event.stopPropagation();
          event.preventDefault();
          this.props.toggleMonthPicker();
        }
        break;
      }
    }
  }

  /**
   * Update localizable IDs of the spinner and its Prev/Next buttons
   */
  _updateButtonLabels() {
    document.l10n.setAttributes(
      this.components.month.elements.spinner,
      "date-spinner-month"
    );
    document.l10n.setAttributes(
      this.components.year.elements.spinner,
      "date-spinner-year"
    );
    document.l10n.setAttributes(
      this.components.month.elements.up,
      "date-spinner-month-previous"
    );
    document.l10n.setAttributes(
      this.components.month.elements.down,
      "date-spinner-month-next"
    );
    document.l10n.setAttributes(
      this.components.year.elements.up,
      "date-spinner-year-previous"
    );
    document.l10n.setAttributes(
      this.components.year.elements.down,
      "date-spinner-year-next"
    );
    document.l10n.translateRoots();
  }

  /**
   * Attach event listener to monthYear button
   */
  _attachEventListeners() {
    this.context.monthYear.addEventListener("click", this);
    this.context.monthYear.addEventListener("keydown", this);
  }
}
