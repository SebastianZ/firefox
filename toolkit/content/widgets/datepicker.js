/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* import-globals-from datekeeper.js */
/* import-globals-from calendar.js */
/* import-globals-from spinner.js */
/* import-globals-from monthpicker.js */

"use strict";

function DatePicker(context) {
  this.context = context;
  this._attachEventListeners();
}

{
  const CAL_VIEW_SIZE = 42;

  DatePicker.prototype = {
    /**
     * Initializes the date picker. Set the default states and properties.
     * @param  {Object} props
     *         {
     *           {Number} year [optional]
     *           {Number} month [optional]
     *           {Number} date [optional]
     *           {Number} min
     *           {Number} max
     *           {Number} step
     *           {Number} stepBase
     *           {Number} firstDayOfWeek
     *           {Array<Number>} weekends
     *           {Array<String>} monthStrings
     *           {Array<String>} weekdayStrings
     *           {String} locale [optional]: User preferred locale
     *         }
     */
    init(props = {}) {
      this.props = props;
      this._setDefaultState();
      this._createComponents();
      this._update();
      this.components.calendar.focusDay();
      // TODO(bug 1828721): This is a bit sad.
      window.PICKER_READY = true;
      document.dispatchEvent(new CustomEvent("PickerReady"));
    },

    /*
     * Set initial date picker states.
     */
    _setDefaultState() {
      const {
        year,
        month,
        day,
        min,
        max,
        step,
        stepBase,
        firstDayOfWeek,
        weekends,
        monthStrings,
        weekdayStrings,
        locale,
        dir,
      } = this.props;
      const dateKeeper = new DateKeeper({
        year,
        month,
        day,
        min,
        max,
        step,
        stepBase,
        firstDayOfWeek,
        weekends,
        calViewSize: CAL_VIEW_SIZE,
      });

      document.dir = dir;

      this.state = {
        dateKeeper,
        locale,
        isMonthPickerVisible: false,
        datetimeOrders: new Intl.DateTimeFormat(locale)
          .formatToParts(new Date(0))
          .map(part => part.type),
        getDayString: day =>
          day ? new Intl.NumberFormat(locale).format(day) : "",
        getWeekHeaderString: weekday => weekdayStrings[weekday],
        getMonthString: month => monthStrings[month],
        setSelection: date => {
          dateKeeper.setSelection({
            year: date.getUTCFullYear(),
            month: date.getUTCMonth(),
            day: date.getUTCDate(),
          });
          this._update();
          this._dispatchState();
          this._closePopup();
        },
        setMonthByOffset: offset => {
          dateKeeper.setMonthByOffset(offset);
          this._update();
        },
        setYear: year => {
          dateKeeper.setYear(year);
          dateKeeper.setSelection({
            year,
            month: dateKeeper.selection.month,
            day: dateKeeper.selection.day,
          });
          this._update();
          this._dispatchState();
        },
        setMonth: month => {
          dateKeeper.setMonth(month);
          dateKeeper.setSelection({
            year: dateKeeper.selection.year,
            month,
            day: dateKeeper.selection.day,
          });
          this._update();
          this._dispatchState();
        },
        toggleMonthPicker: () => {
          this.state.isMonthPickerVisible = !this.state.isMonthPickerVisible;
          this._update();
        },
      };
    },

    /**
     * Initalize the date picker components.
     */
    _createComponents() {
      this.components = {
        calendar: new Calendar(
          {
            calViewSize: CAL_VIEW_SIZE,
            locale: this.state.locale,
            setSelection: this.state.setSelection,
            // Year and month could be changed without changing a selection
            setCalendarMonth: (year, month) => {
              this.state.dateKeeper.setCalendarMonth({
                year,
                month,
              });
              this._update();
            },
            getDayString: this.state.getDayString,
            getWeekHeaderString: this.state.getWeekHeaderString,
          },
          {
            weekHeader: this.context.weekHeader,
            daysView: this.context.daysView,
          }
        ),
        monthYear: new MonthYear(
          {
            setYear: this.state.setYear,
            setMonth: this.state.setMonth,
            getMonthString: this.state.getMonthString,
            datetimeOrders: this.state.datetimeOrders,
            locale: this.state.locale,
          },
          {
            monthYear: this.context.monthYear,
            monthYearView: this.context.monthYearView,
          }
        ),
      };
    },

    /**
     * Update date picker and its components.
     */
    _update(options = {}) {
      const { dateKeeper, isMonthPickerVisible } = this.state;

      const calendarEls = [
        this.context.buttonPrev,
        this.context.buttonNext,
        this.context.weekHeader.parentNode,
        this.context.buttonClear,
      ];
      // Update MonthYear state and toggle visibility for sighted users
      // and for assistive technology:
      this.context.monthYearView.hidden = !isMonthPickerVisible;
      for (let el of calendarEls) {
        el.hidden = isMonthPickerVisible;
      }
      this.context.monthYearNav.toggleAttribute(
        "monthPickerVisible",
        isMonthPickerVisible
      );
      if (isMonthPickerVisible) {
        this.state.months = dateKeeper.getMonths();
        this.state.years = dateKeeper.getYears();
      } else {
        this.state.days = dateKeeper.getDays();
      }

      this.components.monthYear.setProps({
        isVisible: isMonthPickerVisible,
        dateObj: dateKeeper.state.dateObj,
        months: this.state.months,
        years: this.state.years,
        toggleMonthPicker: this.state.toggleMonthPicker,
        noSmoothScroll: options.noSmoothScroll,
      });
      this.components.calendar.setProps({
        isVisible: !isMonthPickerVisible,
        days: this.state.days,
        weekHeaders: dateKeeper.state.weekHeaders,
      });
    },

    /**
     * Use postMessage to close the picker.
     */
    _closePopup(clear = false) {
      window.postMessage(
        {
          name: "ClosePopup",
          detail: clear,
        },
        "*"
      );
    },

    /**
     * Use postMessage to pass the state of picker to the panel.
     */
    _dispatchState() {
      const { year, month, day } = this.state.dateKeeper.selection;

      // The panel is listening to window for postMessage event, so we
      // do postMessage to itself to send data to input boxes.
      window.postMessage(
        {
          name: "PickerPopupChanged",
          detail: {
            year,
            month,
            day,
          },
        },
        "*"
      );
    },

    /**
     * Attach event listeners
     */
    _attachEventListeners() {
      window.addEventListener("message", this);
      document.addEventListener("mouseup", this, { passive: true });
      document.addEventListener("pointerdown", this, { passive: true });
      document.addEventListener("mousedown", this);
      document.addEventListener("keydown", this);
    },

    /**
     * Handle events.
     *
     * @param  {Event} event
     */
    handleEvent(event) {
      switch (event.type) {
        case "message": {
          this.handleMessage(event);
          break;
        }
        case "keydown": {
          switch (event.key) {
            case "Enter":
            case " ":
            case "Escape": {
              // If the target is a toggle or a spinner on the month-year panel
              const isOnMonthPicker =
                this.context.monthYearView.parentNode.contains(event.target);

              if (this.state.isMonthPickerVisible && isOnMonthPicker) {
                // While a control on the month-year picker panel is focused,
                // keep the spinner's selection and close the month-year dialog
                event.stopPropagation();
                event.preventDefault();
                this.state.toggleMonthPicker();
                this.components.calendar.focusDay();
                break;
              }
              if (event.key == "Escape") {
                // Close the date picker on Escape from within the picker
                this._closePopup();
                break;
              }
              if (event.target == this.context.buttonPrev) {
                event.target.classList.add("active");
                this.state.setMonthByOffset(-1);
                this.context.buttonPrev.focus();
              } else if (event.target == this.context.buttonNext) {
                event.target.classList.add("active");
                this.state.setMonthByOffset(1);
                this.context.buttonNext.focus();
              } else if (event.target == this.context.buttonClear) {
                event.target.classList.add("active");
                this._closePopup(/* clear = */ true);
              }
              break;
            }
            case "Tab": {
              // Manage tab order of a daysView to prevent keyboard trap
              if (event.target.tagName === "td") {
                if (event.shiftKey) {
                  this.context.buttonNext.focus();
                } else if (!event.shiftKey) {
                  this.context.buttonClear.focus();
                }
                event.stopPropagation();
                event.preventDefault();
              }
              break;
            }
          }
          break;
        }
        case "pointerdown": {
          if (event.pointerType == "mouse") {
            event.target.setPointerCapture(event.pointerId);
          }
          break;
        }
        case "mousedown": {
          // Use preventDefault to keep focus on input boxes
          event.preventDefault();

          if (event.target == this.context.buttonClear) {
            event.target.classList.add("active");
            this._closePopup(/* clear = */ true);
          } else if (event.target == this.context.buttonPrev) {
            event.target.classList.add("active");
            this.state.dateKeeper.setMonthByOffset(-1);
            this._update();
          } else if (event.target == this.context.buttonNext) {
            event.target.classList.add("active");
            this.state.dateKeeper.setMonthByOffset(1);
            this._update();
          }
          break;
        }
        case "mouseup": {
          event.target.releasePointerCapture(event.pointerId);

          if (
            event.target == this.context.buttonPrev ||
            event.target == this.context.buttonNext
          ) {
            event.target.classList.remove("active");
          }
          break;
        }
      }
    },

    /**
     * Handle postMessage events.
     *
     * @param {Event} event
     */
    handleMessage(event) {
      switch (event.data.name) {
        case "PickerSetValue": {
          this.set(event.data.detail);
          break;
        }
        case "PickerInit": {
          this.init(event.data.detail);
          break;
        }
      }
    },

    /**
     * Set the date state and update the components with the new state.
     *
     * @param {Object} dateState
     *        {
     *          {Number} year [optional]
     *          {Number} month [optional]
     *          {Number} date [optional]
     *        }
     */
    set({ year, month, day }) {
      if (!this.state) {
        return;
      }

      const { dateKeeper } = this.state;

      dateKeeper.setCalendarMonth({
        year,
        month,
      });
      dateKeeper.setSelection({
        year,
        month,
        day,
      });
      this._update({ noSmoothScroll: true });
    },
  };
}

document.addEventListener("DOMContentLoaded", () => {
  // Create a DatePicker instance and prepare to be initialized
  // by the "PickerInit" message.
  const root = document.getElementById("date-picker");
  new DatePicker({
    monthYearNav: root.querySelector(".month-year-nav"),
    monthYear: root.querySelector(".month-year"),
    monthYearView: root.querySelector(".month-year-view"),
    buttonPrev: root.querySelector(".prev"),
    buttonNext: root.querySelector(".next"),
    weekHeader: root.querySelector(".week-header"),
    daysView: root.querySelector(".days-view"),
    buttonClear: document.getElementById("clear-button"),
  });
});
