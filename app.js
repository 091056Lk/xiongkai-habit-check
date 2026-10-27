(() => {
  "use strict";

  const STORAGE_KEY = "daily-habits-v1";

  const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const elements = {
    todayLabel: document.querySelector("#todayLabel"),
    habitForm: document.querySelector("#habitForm"),
    habitInput: document.querySelector("#habitInput"),
    formMessage: document.querySelector("#formMessage"),
    habitList: document.querySelector("#habitList"),
    habitTotal: document.querySelector("#habitTotal"),
    emptyState: document.querySelector("#emptyState"),
    completedCount: document.querySelector("#completedCount"),
    totalCount: document.querySelector("#totalCount"),
    progressCopy: document.querySelector("#progressCopy"),
    progressBar: document.querySelector("#progressBar"),
    progressFill: document.querySelector("#progressFill"),
    habitTemplate: document.querySelector("#habitTemplate"),
  };

  let state = loadState();

  function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeTitle(title) {
    return title.trim().replace(/\s+/g, " ");
  }

  function normalizeHabit(value) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const title = typeof value.title === "string" ? normalizeTitle(value.title) : "";
    if (!title) {
      return null;
    }

    return {
      id: typeof value.id === "string" && value.id ? value.id : createId(),
      title: title.slice(0, 40),
      done: value.done === true,
    };
  }

  function parseStoredState(rawValue, today) {
    if (!rawValue) {
      return { date: today, habits: [] };
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (!parsed || !Array.isArray(parsed.habits)) {
        throw new Error("Invalid stored data");
      }

      const seenTitles = new Set();
      const habits = parsed.habits
        .map(normalizeHabit)
        .filter((habit) => {
          if (!habit) {
            return false;
          }

          const normalizedKey = habit.title.toLocaleLowerCase("zh-CN");
          if (seenTitles.has(normalizedKey)) {
            return false;
          }

          seenTitles.add(normalizedKey);
          return true;
        });

      const isToday = parsed.date === today;
      return {
        date: today,
        habits: habits.map((habit) => ({
          ...habit,
          done: isToday ? habit.done : false,
        })),
      };
    } catch {
      return { date: today, habits: [] };
    }
  }

  function loadState() {
    const today = getLocalDateKey();
    let rawValue = null;

    try {
      rawValue = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // The page remains usable in memory when storage is unavailable.
    }

    const nextState = parseStoredState(rawValue, today);
    saveState(nextState);
    return nextState;
  }

  function saveState(nextState = state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      showMessage("浏览器暂时无法保存数据，本次修改仅在当前页面有效。");
    }
  }

  function showMessage(message = "") {
    elements.formMessage.textContent = message;
    elements.habitInput.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function refreshForCurrentDay() {
    const today = getLocalDateKey();
    if (state.date === today) {
      return;
    }

    state = {
      date: today,
      habits: state.habits.map((habit) => ({ ...habit, done: false })),
    };
    saveState();
    render();
  }

  function addHabit(title) {
    const normalizedTitle = normalizeTitle(title);

    if (!normalizedTitle) {
      showMessage("先写下一个习惯，再添加吧。");
      elements.habitInput.focus();
      return false;
    }

    const duplicate = state.habits.some(
      (habit) =>
        habit.title.toLocaleLowerCase("zh-CN") ===
        normalizedTitle.toLocaleLowerCase("zh-CN"),
    );

    if (duplicate) {
      showMessage("这个习惯已经在今天的列表里了。");
      elements.habitInput.select();
      return false;
    }

    state.habits.push({
      id: createId(),
      title: normalizedTitle.slice(0, 40),
      done: false,
    });

    showMessage();
    saveState();
    render();
    elements.habitInput.value = "";
    elements.habitInput.focus();
    return true;
  }

  function toggleHabit(id, done) {
    const habit = state.habits.find((item) => item.id === id);
    if (!habit) {
      return;
    }

    habit.done = done;
    saveState();
    render();

    const updatedCheckbox = elements.habitList.querySelector(
      `.habit-item[data-id="${id}"] .habit-checkbox`,
    );
    updatedCheckbox?.focus();
  }

  function deleteHabit(id) {
    const habit = state.habits.find((item) => item.id === id);
    if (!habit) {
      return;
    }

    const shouldDelete = window.confirm(`确定删除“${habit.title}”吗？`);
    if (!shouldDelete) {
      return;
    }

    state.habits = state.habits.filter((item) => item.id !== id);
    showMessage();
    saveState();
    render();
    elements.habitInput.focus();
  }

  function renderHabit(habit) {
    const fragment = elements.habitTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".habit-item");
    const checkbox = fragment.querySelector(".habit-checkbox");
    const title = fragment.querySelector(".habit-title");
    const deleteButton = fragment.querySelector(".delete-button");
    const deleteLabel = fragment.querySelector(".visually-hidden");

    item.dataset.id = habit.id;
    item.classList.toggle("is-complete", habit.done);
    checkbox.checked = habit.done;
    checkbox.setAttribute("aria-label", `完成：${habit.title}`);
    title.textContent = habit.title;
    deleteLabel.textContent = `删除习惯：${habit.title}`;

    checkbox.addEventListener("change", () => {
      toggleHabit(habit.id, checkbox.checked);
    });

    deleteButton.addEventListener("click", () => {
      deleteHabit(habit.id);
    });

    return fragment;
  }

  function updateProgress() {
    const total = state.habits.length;
    const completed = state.habits.filter((habit) => habit.done).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    elements.completedCount.textContent = String(completed);
    elements.totalCount.textContent = String(total);
    elements.habitTotal.textContent = `${total} 项`;
    elements.progressBar.setAttribute("aria-valuenow", String(percentage));
    elements.progressFill.style.transform = `scaleX(${percentage / 100})`;

    if (total === 0) {
      elements.progressCopy.textContent = "写下今天想坚持的习惯吧";
    } else if (completed === total) {
      elements.progressCopy.textContent = "今天的习惯全部完成，做得很好";
    } else {
      elements.progressCopy.textContent = `已经完成 ${percentage}%，继续慢慢来`;
    }
  }

  function render() {
    elements.todayLabel.textContent = dateFormatter.format(new Date());
    elements.emptyState.hidden = state.habits.length > 0;
    elements.habitList.hidden = state.habits.length === 0;
    elements.habitList.replaceChildren(
      ...state.habits.map((habit) => renderHabit(habit)),
    );
    updateProgress();
  }

  elements.habitForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addHabit(elements.habitInput.value);
  });

  elements.habitInput.addEventListener("input", () => {
    if (elements.formMessage.textContent) {
      showMessage();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshForCurrentDay();
    }
  });

  window.addEventListener("focus", refreshForCurrentDay);

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) {
      return;
    }

    state = parseStoredState(event.newValue, getLocalDateKey());
    render();
  });

  render();
})();
