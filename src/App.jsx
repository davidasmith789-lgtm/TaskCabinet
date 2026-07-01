import { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "./App.css";

/**
 * TASKACADIA APPLICATION GUIDE
 *
 * This file contains the app's data, behavior, and visible React interface.
 * how to read it is from top to bottom:
 *
 * 1. Helper functions answer small questions such as "Is dark mode preferred?"
 * 2. React state remembers information that can change while the app is open.
 * 3. Effects synchronize selected state with the browser and localStorage.
 * 4. Event handlers respond to clicks, typing, form submissions, and edits.
 * 5. Derived values filter and sort the task data without storing extra copies.
 * 6. The final return statement describes what appears on each screen.
 *
 * The main task object has this general shape:
 * {
 *   id, title, course, dueMonth, dueDay, dueHour, dueAmPm,
 *   estimatedMinutes, priority, repeat, isCompleted, status, notes, subtasks
 * }
 *
 * Data is saved in localStorage, so refreshing the browser does not erase it.
 * Each username receives separate task, course, and course-color storage keys.
 */



/**
 * Read the operating system's preferred color scheme.
 * This is only used when the user has not already saved a theme choice.
 */
function getSystemPreference() {
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

/**
 * Convert a stored month/day into a friendly urgency group.
 *
 * TaskAcadia currently stores month and day, but not a year. For that reason,
 * this helper compares every task with the current calendar year. The exact
 * returned strings are also used by filtering, sorting, counts, and headings,
 * so update those related features together if these labels ever change.
 */
function getDueDateBucket(dueMonth, dueDay) {
  if (!dueMonth || !dueDay) return "No Due Date";

  const now = new Date();
  const currentYear = now.getFullYear();

  // JavaScript months start at 0, so January is month 0, February is month 1, etc.
  const taskDate = new Date(currentYear, Number(dueMonth) - 1, Number(dueDay));

  // Midnight removes the current time of day from the date comparison.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // In this app, a week ends on Saturday.
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (6 - today.getDay()));

  const endOfNextWeek = new Date(endOfWeek);
  endOfNextWeek.setDate(endOfNextWeek.getDate() + 7);

  const diffTime = taskDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Overdue 🚨";
  if (diffDays === 0) return "Due Today ⏰";
  if (diffDays === 1) return "Due Tomorrow 🗓️";
  if (taskDate <= endOfWeek) return "Due This Week";
  if (taskDate <= endOfNextWeek) return "Due Next Week";
  return "Due Later";
}

/**
 * Return a safe checklist array for any task.
 *
 * Older assignments in localStorage do not have a subtasks property yet. This
 * helper lets the rest of the app treat those assignments as having an empty
 * checklist instead of crashing or forcing a localStorage migration.
 */
function getSafeSubtasks(task) {
  if (!Array.isArray(task?.subtasks)) return [];

  return task.subtasks.map((subtask, index) => ({
    id: subtask.id ?? `${task.id || "task"}-step-${index}`,
    text: subtask.text || "",
    isDone: Boolean(subtask.isDone),
  }));
}

/**
 * Decide which workflow column a task belongs in.
 *
 * isCompleted stays the most important source of truth so old completion logic
 * and old saved data continue to behave correctly. status adds more detail for
 * incomplete assignments: either todo or inProgress.
 */
function getTaskStatus(task) {
  if (task?.isCompleted) return "completed";
  if (task?.status === "inProgress") return "inProgress";
  return "todo";
}

/**
 * Summarize checklist progress for compact task cards.
 * Returning null means the task has no checklist and should not show clutter.
 */
function getSubtaskProgress(task) {
  const subtasks = getSafeSubtasks(task);

  if (subtasks.length === 0) return null;

  const completedCount = subtasks.filter((subtask) => subtask.isDone).length;

  return {
    completedCount,
    totalCount: subtasks.length,
    label: `${completedCount}/${subtasks.length} steps done`,
  };
}

/**
 * Build one checklist step from user-entered text.
 * Empty text returns null so blank steps are quietly ignored.
 */
function createSubtask(text) {
  const trimmedText = text.trim();

  if (!trimmedText) return null;

  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    text: trimmedText,
    isDone: false,
  };
}

/**
 * Create the next occurrence of a repeating task.
 *
 * This helper lives outside the React component because it creates a unique ID
 * with the current time and a random number. It is called only from the Complete
 * button's event handler, never while React is calculating the interface.
 *
 * Returning null means no follow-up task should be created. Monthly repeats
 * receive special handling: a task on the 31st moves to the last valid day when
 * the following month has fewer than 31 days.
 */
function getNextRepeatingTask(task) {
  if (!task.repeat || task.repeat === "NONE") return null;
  if (!task.dueMonth || !task.dueDay) return null;

  const currentYear = new Date().getFullYear();
  let nextDate = new Date(
    currentYear,
    Number(task.dueMonth) - 1,
    Number(task.dueDay),
  );

  if (task.repeat === "DAILY") {
    nextDate.setDate(nextDate.getDate() + 1);
  }

  if (task.repeat === "WEEKLY") {
    nextDate.setDate(nextDate.getDate() + 7);
  }

  if (task.repeat === "MONTHLY") {
    const originalDay = Number(task.dueDay);
    let nextMonthIndex = Number(task.dueMonth);

    let nextYear = currentYear;
    if (nextMonthIndex > 11) {
      nextMonthIndex = 0;
      nextYear += 1;
    }

    const daysInNextMonth = new Date(
      nextYear,
      nextMonthIndex + 1,
      0,
    ).getDate();

    nextDate = new Date(
      nextYear,
      nextMonthIndex,
      Math.min(originalDay, daysInNextMonth),
    );
  }

  return {
    ...task,
    id: Date.now() + Math.floor(Math.random() * 1000),
    dueMonth: String(nextDate.getMonth() + 1).padStart(2, "0"),
    dueDay: String(nextDate.getDate()).padStart(2, "0"),
    isCompleted: false,
    status: "todo",
    subtasks: getSafeSubtasks(task).map((subtask) => ({
      ...subtask,
      isDone: false,
    })),
    createdFromRepeat: task.id,
  };
}

/**
 * Main application component.
 *
 * React re-runs this function whenever state changes. React then compares the
 * returned JSX with the current page and updates only the necessary elements.
 */
function App() {
  // ---------------------------------------------------------------------------
  // USER PROFILE AND STORAGE NAMESPACES
  // ---------------------------------------------------------------------------
  // currentUser is an empty string in guest mode. The function passed to
  // useState runs only during the first render and restores the last profile.
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return localStorage.getItem("currentUser") || "";
    } catch (error) {
      console.error("Error reading currentUser from localStorage:", error);
      return "";
    }
  });
  const [signInName, setSignInName] = useState("");

  // A username becomes part of each key. This keeps one user's data separate
  // from another user's data while still using the same browser localStorage.
  const currentStorageKey = currentUser
    ? `tasks_${currentUser}`
    : "tasks_guest";
  const courseStorageKey = currentUser
    ? `courses_${currentUser}`
    : "courses_guest";
  const courseColorsStorageKey = currentUser
    ? `courseColors_${currentUser}`
    : "courseColors_guest";

  // ---------------------------------------------------------------------------
  // COURSES AND COURSE COLORS
  // ---------------------------------------------------------------------------
  // "Other" is permanent because deleted courses move their assignments there.
  const [courses, setCourses] = useState(() => {
    try {
      const storedCourses = localStorage.getItem(courseStorageKey);
      return storedCourses
        ? JSON.parse(storedCourses)
        : ["AP Stat", "British Literature", "Calculus H", "APES", "Other"];
    } catch (error) {
      console.error("Error reading courses from localStorage:", error);
      return ["AP Stat", "British Literature", "Calculus H", "APES", "Other"];
    }
  });
  const [courseColors, setCourseColors] = useState(() => {
    try {
      const storedColors = localStorage.getItem(courseColorsStorageKey);
      return storedColors ? JSON.parse(storedColors) : {};
    } catch (error) {
      console.error("Error reading course colors from localStorage:", error);
      return {};
    }
  });

  const [isCustomCourse, setIsCustomCourse] = useState(false);
  const [customCourseName, setCustomCourseName] = useState("");

  // ---------------------------------------------------------------------------
  // ADD ASSIGNMENT FORM
  // ---------------------------------------------------------------------------
  // These are "controlled inputs": each input displays a state value and uses
  // its onChange handler to put the user's latest typing back into that state.
  const [taskName, setTaskName] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [dueMonth, setDueMonth] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [dueHour, setDueHour] = useState("11");
  const [dueAmPm, setDueAmPm] = useState("PM");
  const [estTime, setEstTime] = useState("");
  const [priority, setPriority] = useState("MED");
  const [repeatFrequency, setRepeatFrequency] = useState("NONE");
  const [newSubtaskText, setNewSubtaskText] = useState("");
  const [draftSubtasks, setDraftSubtasks] = useState([]);

  // ---------------------------------------------------------------------------
  // TASK DATA, NAVIGATION, FILTERS, AND OPEN/CLOSED PANELS
  // ---------------------------------------------------------------------------
  // tasks is the app's central data array. The remaining values describe what
  // the user is currently viewing; they are interface state rather than data.
  const [tasks, setTasks] = useState([]);
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCourse, setFilterCourse] = useState("ALL");
  const [filterPriority, setFilterPriority] = useState("ALL");
  const [filterDueBucket, setFilterDueBucket] = useState("ALL");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [editSubtaskText, setEditSubtaskText] = useState("");
  const [filterRepeat, setFilterRepeat] = useState("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addAssignmentOpen, setAddAssignmentOpen] = useState(true);
  const [courseColorsOpen, setCourseColorsOpen] = useState(true);

  // ---------------------------------------------------------------------------
  // COLOR THEME
  // ---------------------------------------------------------------------------
  // Prefer the saved selection, then fall back to the operating system theme.
  const [theme, setTheme] = useState(() => {
    try {
      const storedTheme = localStorage.getItem("theme");
      return storedTheme ? storedTheme : getSystemPreference();
    } catch (error) {
      console.error("Error reading theme from localStorage:", error);
      return getSystemPreference();
    }
  });

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // Turn the compact values stored on a task into text suitable for the UI.
  const formatRepeatLabel = (repeat) => {
    if (repeat === "DAILY") return "Daily";
    if (repeat === "WEEKLY") return "Weekly";
    if (repeat === "MONTHLY") return "Monthly";
    return "Does not repeat";
  };

  // Courses without a custom choice use the app's default blue.
  const getCourseColor = (course) => {
    return courseColors[course] || "#3b82f6";
  };

  /**
   * Choose readable black or white text for a colored course badge.
   * The brightness formula gives green more visual weight because human eyes
   * perceive green as brighter than equally strong red or blue values.
   */
  const getTextColorForCourse = (course) => {
    const color = getCourseColor(course).replace("#", "");

    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);

    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    return brightness > 160 ? "#111827" : "#ffffff";
  };

  // Build the one-line details shown beneath task names in several tabs.
  const formatTaskDetails = (task) => {
    const hasDate = task.dueMonth && task.dueDay;
    const monthLabel = hasDate ? monthNames[Number(task.dueMonth) - 1] : null;
    const dateLabel = hasDate
      ? `${monthLabel} ${Number(task.dueDay)}`
      : "No date";
    const timeLabel = task.dueHour
      ? `${task.dueHour} ${task.dueAmPm || ""}`
      : "No time";
    const repeatLabel =
      task.repeat && task.repeat !== "NONE"
        ? ` | 🔁 Repeats: ${formatRepeatLabel(task.repeat)}`
        : "";

    return `📅 Due: ${dateLabel} at ${timeLabel} | ⏱️ Est: ${task.estimatedMinutes || 0} mins | ⚠️ Priority: ${task.priority}${repeatLabel}`;
  };

  // ---------------------------------------------------------------------------
  // EFFECTS: SYNCHRONIZE REACT WITH THE BROWSER
  // ---------------------------------------------------------------------------
  // CSS reads data-theme from the root <html> element. The same effect saves
  // the choice so the theme survives a refresh.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch (error) {
      console.error("Error writing theme to localStorage:", error);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  // Whenever the active profile changes, load that profile's three datasets.
  // If stored JSON is damaged or unavailable, use safe empty/default values.
  // This effect intentionally copies an external browser data source into React
  // state. The targeted lint exception documents that profile switching is the
  // synchronization event, rather than an accidental state-calculation effect.
  /* eslint-disable react-hooks/set-state-in-effect -- Load the selected localStorage profile when its keys change. */
  useEffect(() => {
    try {
      const rawTasks = localStorage.getItem(currentStorageKey);
      setTasks(rawTasks ? JSON.parse(rawTasks) : []);

      const rawCourses = localStorage.getItem(courseStorageKey);
      setCourses(
        rawCourses
          ? JSON.parse(rawCourses)
          : ["AP Stat", "British Literature", "Calculus H", "APES", "Other"],
      );

      const rawCourseColors = localStorage.getItem(courseColorsStorageKey);
      setCourseColors(rawCourseColors ? JSON.parse(rawCourseColors) : {});
    } catch (error) {
      console.error("Failed to load user data from localStorage:", error);
      setTasks([]);
      setCourses([
        "AP Stat",
        "British Literature",
        "Calculus H",
        "APES",
        "Other",
      ]);
      setCourseColors({});
    }

    setIsCustomCourse(false);
    setCustomCourseName("");
  }, [currentStorageKey, courseStorageKey, courseColorsStorageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Remember which profile should be restored on the next browser visit.
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem("currentUser", currentUser);
      } else {
        localStorage.removeItem("currentUser");
      }
    } catch (error) {
      console.error("Failed to persist currentUser to localStorage:", error);
    }
  }, [currentUser]);

  // ---------------------------------------------------------------------------
  // EVENT HANDLERS: CREATE AND UPDATE DATA
  // ---------------------------------------------------------------------------
  // Event handlers run in response to an action such as a click or form submit.
  // Any handler that changes task data also saves the resulting array.

  /** Add one optional checklist step to the unsaved Add Assignment form. */
  const handleAddDraftSubtask = () => {
    const newSubtask = createSubtask(newSubtaskText);

    if (!newSubtask) return;

    setDraftSubtasks((prev) => [...prev, newSubtask]);
    setNewSubtaskText("");
  };

  /** Remove one optional checklist step before the assignment is saved. */
  const handleRemoveDraftSubtask = (subtaskId) => {
    setDraftSubtasks((prev) =>
      prev.filter((subtask) => subtask.id !== subtaskId),
    );
  };

  /** Add one task, optionally add its custom course, and reset the form. */
  const handleAddTask = (e) => {
    e.preventDefault();

    const finalCourse = isCustomCourse
      ? customCourseName.trim()
      : selectedCourse;
    if (!taskName || !finalCourse) return;

    if (isCustomCourse && !courses.includes(finalCourse)) {
      const updatedCourses = [...courses, finalCourse].sort();
      setCourses(updatedCourses);
      try {
        localStorage.setItem(courseStorageKey, JSON.stringify(updatedCourses));
      } catch (error) {
        console.error("Failed to save updated courses list:", error);
      }
    }

    const newTask = {
      id: Date.now(),
      title: taskName,
      course: finalCourse,
      dueMonth: dueMonth,
      dueDay: dueDay,
      dueHour: dueHour,
      dueAmPm: dueAmPm,
      estimatedMinutes: estTime,
      priority: priority,
      repeat: repeatFrequency,
      isCompleted: false,
      status: "todo",
      notes: "",
      subtasks: draftSubtasks,
    };

    setTasks((prev) => {
      const updated = [...prev, newTask];
      try {
        localStorage.setItem(currentStorageKey, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save tasks:", error);
      }
      return updated;
    });

    // Return the form to friendly defaults after a successful submission.
    setTaskName("");
    setSelectedCourse("");
    setCustomCourseName("");
    setIsCustomCourse(false);
    setDueMonth("");
    setDueDay("");
    setDueHour("11");
    setDueAmPm("PM");
    setEstTime("");
    setPriority("MED");
    setRepeatFrequency("NONE");
    setNewSubtaskText("");
    setDraftSubtasks([]);
  };

  /** Save a new color under the selected course name. */
  const handleCourseColorChange = (course, color) => {
    setCourseColors((prev) => {
      const updated = {
        ...prev,
        [course]: color,
      };

      try {
        localStorage.setItem(courseColorsStorageKey, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save course colors:", error);
      }

      return updated;
    });
  };

  /**
   * Delete a course safely.
   * Existing tasks are not deleted; they are reassigned to "Other" instead.
   */
  const handleDeleteCourse = (courseToDelete) => {
    if (courseToDelete === "Other") {
      alert('The "Other" course cannot be deleted.');
      return;
    }

    const confirmDelete = window.confirm(
      `Delete "${courseToDelete}"? Any assignments using this course will be moved to "Other".`,
    );

    if (!confirmDelete) return;

    const updatedCourses = courses.filter(
      (course) => course !== courseToDelete,
    );

    setCourses(updatedCourses);

    try {
      localStorage.setItem(courseStorageKey, JSON.stringify(updatedCourses));
    } catch (error) {
      console.error("Failed to save courses after deleting course:", error);
    }

    setCourseColors((prev) => {
      const updatedColors = { ...prev };
      delete updatedColors[courseToDelete];

      try {
        localStorage.setItem(
          courseColorsStorageKey,
          JSON.stringify(updatedColors),
        );
      } catch (error) {
        console.error(
          "Failed to save course colors after deleting course:",
          error,
        );
      }

      return updatedColors;
    });

    setTasks((prev) => {
      const updatedTasks = prev.map((task) =>
        task.course === courseToDelete ? { ...task, course: "Other" } : task,
      );

      saveTasksForCurrentUser(updatedTasks);
      return updatedTasks;
    });
  };

  // Keeping localStorage writing in one helper prevents repeated try/catch code
  // throughout the task handlers below.
  const saveTasksForCurrentUser = (updated) => {
    try {
      localStorage.setItem(currentStorageKey, JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to save tasks to localStorage:", error);
    }
  };

  /**
   * Return a new task array with one assignment completed.
   *
   * This central helper keeps the Complete button and checklist auto-complete
   * behavior identical. Repeating tasks still create their next occurrence, and
   * that new occurrence starts fresh in To Do with unchecked checklist steps.
   */
  const completeTaskList = (taskList, id) => {
    const taskToComplete = taskList.find((task) => task.id === id);

    if (!taskToComplete) return taskList;

    const completedTasks = taskList.map((task) => {
      if (task.id !== id) return task;

      const subtasks = getSafeSubtasks(task);

      return {
        ...task,
        isCompleted: true,
        status: "completed",
        subtasks: subtasks.map((subtask) => ({
          ...subtask,
          isDone: true,
        })),
      };
    });

    const nextRepeatingTask = getNextRepeatingTask(taskToComplete);

    return nextRepeatingTask
      ? [...completedTasks, nextRepeatingTask]
      : completedTasks;
  };

  // A single ID tracks the task whose inline notes panel is currently open.
  const toggleTaskExpansion = (id) => {
    setExpandedTaskId((prev) => (prev === id ? null : id));
  };

  // Notes save on every change, so no separate Save Notes button is required.
  const handleNoteChange = (id, notes) => {
    setTasks((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, notes } : t));
      saveTasksForCurrentUser(updated);
      return updated;
    });
  };

  // Completing a repeating task also appends its next incomplete occurrence.
  const handleComplete = (id) => {
    setTasks((prev) => {
      const updated = completeTaskList(prev, id);

      saveTasksForCurrentUser(updated);
      return updated;
    });
  };

  // Starting an assignment moves it from To Do into the new In Progress tab.
  const handleStartTask = (id) => {
    setTasks((prev) => {
      const updated = prev.map((task) =>
        task.id === id
          ? { ...task, isCompleted: false, status: "inProgress" }
          : task,
      );

      saveTasksForCurrentUser(updated);
      return updated;
    });
  };

  // This is the safety valve if a user starts something by mistake.
  const handleMoveToTodo = (id) => {
    setTasks((prev) => {
      const updated = prev.map((task) =>
        task.id === id
          ? { ...task, isCompleted: false, status: "todo" }
          : task,
      );

      saveTasksForCurrentUser(updated);
      return updated;
    });
  };

  /**
   * Toggle one checklist step.
   *
   * If, and only if, a task has at least one checklist step and every step is
   * checked after this click, the task automatically moves to Completed.
   */
  const handleSubtaskToggle = (taskId, subtaskId) => {
    setTasks((prev) => {
      let shouldCompleteTask = false;

      const taskListWithToggledStep = prev.map((task) => {
        if (task.id !== taskId) return task;

        const updatedSubtasks = getSafeSubtasks(task).map((subtask) =>
          subtask.id === subtaskId
            ? { ...subtask, isDone: !subtask.isDone }
            : subtask,
        );

        shouldCompleteTask =
          updatedSubtasks.length > 0 &&
          updatedSubtasks.every((subtask) => subtask.isDone);

        return {
          ...task,
          subtasks: updatedSubtasks,
        };
      });

      const updated = shouldCompleteTask
        ? completeTaskList(taskListWithToggledStep, taskId)
        : taskListWithToggledStep;

      saveTasksForCurrentUser(updated);
      return updated;
    });
  };

  // Undo changes only completion status; all other task information is kept.
  const handleUndo = (id) => {
    setTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === id ? { ...t, isCompleted: false, status: "todo" } : t,
      );
      saveTasksForCurrentUser(updated);
      return updated;
    });
  };

  // Deleting creates a new array that omits the task with the matching ID.
  const handleDelete = (id) => {
    setTasks((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      saveTasksForCurrentUser(updated);
      return updated;
    });
  };

  // Copy the selected task into temporary editing state. Changes made in the
  // modal remain temporary until handleEditSave replaces the stored task.
  const handleEditStart = (task) => {
    setEditingTaskId(task.id);
    setEditingTask({
      ...task,
      title: task.title || "",
      status: getTaskStatus(task),
      repeat: task.repeat || "NONE",
      notes: task.notes || "",
      subtasks: getSafeSubtasks(task),
      estimatedMinutes: task.estimatedMinutes || "",
      dueHour: task.dueHour || "11",
      dueAmPm: task.dueAmPm || "PM",
    });
    setEditSubtaskText("");
  };

  // One generic field handler works for every input in the edit modal.
  const handleEditFieldChange = (field, value) => {
    setEditingTask((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /** Add a checklist step while editing an existing assignment. */
  const handleAddEditSubtask = () => {
    const newSubtask = createSubtask(editSubtaskText);

    if (!newSubtask) return;

    setEditingTask((prev) => ({
      ...prev,
      subtasks: [...getSafeSubtasks(prev), newSubtask],
    }));
    setEditSubtaskText("");
  };

  /** Rename a checklist step in the temporary edit-modal copy. */
  const handleEditSubtaskTextChange = (subtaskId, text) => {
    setEditingTask((prev) => ({
      ...prev,
      subtasks: getSafeSubtasks(prev).map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, text } : subtask,
      ),
    }));
  };

  /** Toggle a checklist step in the temporary edit-modal copy. */
  const handleEditSubtaskToggle = (subtaskId) => {
    setEditingTask((prev) => ({
      ...prev,
      subtasks: getSafeSubtasks(prev).map((subtask) =>
        subtask.id === subtaskId
          ? { ...subtask, isDone: !subtask.isDone }
          : subtask,
      ),
    }));
  };

  /** Remove a checklist step while editing an existing assignment. */
  const handleRemoveEditSubtask = (subtaskId) => {
    setEditingTask((prev) => ({
      ...prev,
      subtasks: getSafeSubtasks(prev).filter(
        (subtask) => subtask.id !== subtaskId,
      ),
    }));
  };

  // Validate the title, update the matching task, save, and close the modal.
  const handleEditSave = () => {
    if (!editingTask) return;

    const cleanedTitle = editingTask.title.trim();
    const cleanedCourse = editingTask.course || "Other";
    const cleanedSubtasks = getSafeSubtasks(editingTask).filter((subtask) =>
      subtask.text.trim(),
    );
    const shouldAutoCompleteFromSubtasks =
      cleanedSubtasks.length > 0 &&
      cleanedSubtasks.every((subtask) => subtask.isDone);
    const isCompleted =
      Boolean(editingTask.isCompleted) || shouldAutoCompleteFromSubtasks;

    if (!cleanedTitle) {
      alert("Assignment name cannot be empty.");
      return;
    }

    const updatedTask = {
      ...editingTask,
      title: cleanedTitle,
      course: cleanedCourse,
      repeat: editingTask.repeat || "NONE",
      isCompleted,
      status: isCompleted ? "completed" : getTaskStatus(editingTask),
      subtasks: cleanedSubtasks,
    };

    setTasks((prev) => {
      const updated = prev.map((task) =>
        task.id === editingTaskId ? updatedTask : task,
      );

      saveTasksForCurrentUser(updated);
      return updated;
    });

    setEditingTaskId(null);
    setEditingTask(null);
  };

  // Canceling discards the temporary editing copy without changing tasks.
  const handleEditCancel = () => {
    setEditingTaskId(null);
    setEditingTask(null);
    setEditSubtaskText("");
  };

  // Usernames are local profile names, not server-backed authentication.
  const handleSignIn = (e) => {
    e.preventDefault();
    const trimmedName = signInName.trim();
    if (!trimmedName) return;
    setCurrentUser(trimmedName);
    setSignInName("");
    setCurrentTab("dashboard");
  };

  const handleSignOut = () => {
    setCurrentUser("");
    setCurrentTab("dashboard");
  };

  const isFormInvalid =
    !taskName || (isCustomCourse ? !customCourseName.trim() : !selectedCourse);

  // ---------------------------------------------------------------------------
  // DERIVED DATA: FILTERING, SORTING, RECOMMENDATIONS, AND COUNTS
  // ---------------------------------------------------------------------------
  // Derived values are recalculated from tasks during rendering. They are not
  // separate state and are never written to localStorage, which avoids stale or
  // conflicting copies of the same information.

  const bucketsOrder = [
    "Overdue 🚨",
    "Due Today ⏰",
    "Due Tomorrow 🗓️",
    "Due This Week",
    "Due Next Week",
    "Due Later",
    "No Due Date",
  ];

  // A task must pass every active filter. "ALL" means that particular filter
  // is disabled. Search checks the title, course, and optional notes together.
  const assignmentMatchesFilters = (task) => {
    const search = searchTerm.trim().toLowerCase();
    const matchesRepeat =
      filterRepeat === "ALL" || (task.repeat || "NONE") === filterRepeat;
    const matchesSearch =
      !search ||
      task.title.toLowerCase().includes(search) ||
      task.course.toLowerCase().includes(search) ||
      (task.notes || "").toLowerCase().includes(search);

    const matchesCourse =
      filterCourse === "ALL" || task.course === filterCourse;

    const matchesPriority =
      filterPriority === "ALL" || task.priority === filterPriority;

    const taskBucket = getDueDateBucket(task.dueMonth, task.dueDay);

    const matchesDueBucket =
      filterDueBucket === "ALL" || taskBucket === filterDueBucket;

    return (
      matchesSearch &&
      matchesCourse &&
      matchesPriority &&
      matchesDueBucket &&
      matchesRepeat
    );
  };

  const todoTasks = tasks.filter(
    (task) =>
      getTaskStatus(task) === "todo" && assignmentMatchesFilters(task),
  );

  const inProgressTasks = tasks.filter(
    (task) =>
      getTaskStatus(task) === "inProgress" && assignmentMatchesFilters(task),
  );

  const completedTasks = tasks.filter(
    (task) =>
      getTaskStatus(task) === "completed" && assignmentMatchesFilters(task),
  );

  // To Do and In Progress use the same student-friendly order: urgent first,
  // then high priority, then shorter assignments.
  const sortAssignmentsByDuePriorityEstimate = (taskList) => {
    const priorityMap = { HIGH: 3, MED: 2, LOW: 1 };

    return [...taskList].sort((a, b) => {
      const bucketA = bucketsOrder.indexOf(
        getDueDateBucket(a.dueMonth, a.dueDay),
      );
      const bucketB = bucketsOrder.indexOf(
        getDueDateBucket(b.dueMonth, b.dueDay),
      );

      if (bucketA !== bucketB) {
        return bucketA - bucketB;
      }

      if (priorityMap[b.priority] !== priorityMap[a.priority]) {
        return priorityMap[b.priority] - priorityMap[a.priority];
      }

      return (
        (Number(a.estimatedMinutes) || 0) - (Number(b.estimatedMinutes) || 0)
      );
    });
  };

  const sortedTodoTasks = sortAssignmentsByDuePriorityEstimate(todoTasks);
  const sortedInProgressTasks =
    sortAssignmentsByDuePriorityEstimate(inProgressTasks);

  const recommendationPriorityOrder = { HIGH: 0, MED: 1, LOW: 2 };

  // Infinity deliberately places missing, zero, negative, or invalid estimates
  // after real estimates when estimated time is used as the final tie-breaker.
  const getRecommendationEstimate = (task) => {
    const estimatedMinutes = Number(task.estimatedMinutes);
    return Number.isFinite(estimatedMinutes) && estimatedMinutes > 0
      ? estimatedMinutes
      : Number.POSITIVE_INFINITY;
  };

  /**
   * Dashboard recommendation rules, in order:
   * 1. Most urgent due-date bucket
   * 2. HIGH, then MED, then LOW priority
   * 3. Shortest valid estimated time
   * 4. Alphabetical title for a stable final tie
   */
  const recommendedTasks = tasks
    .filter((task) => getTaskStatus(task) !== "completed")
    .sort((a, b) => {
      const bucketA = bucketsOrder.indexOf(
        getDueDateBucket(a.dueMonth, a.dueDay),
      );
      const bucketB = bucketsOrder.indexOf(
        getDueDateBucket(b.dueMonth, b.dueDay),
      );
      const safeBucketA = bucketA === -1 ? bucketsOrder.length : bucketA;
      const safeBucketB = bucketB === -1 ? bucketsOrder.length : bucketB;

      if (safeBucketA !== safeBucketB) return safeBucketA - safeBucketB;

      const priorityA = recommendationPriorityOrder[a.priority] ?? 3;
      const priorityB = recommendationPriorityOrder[b.priority] ?? 3;

      if (priorityA !== priorityB) return priorityA - priorityB;

      const estimateA = getRecommendationEstimate(a);
      const estimateB = getRecommendationEstimate(b);

      if (estimateA !== estimateB) return estimateA - estimateB;

      return (a.title || "").localeCompare(b.title || "");
    })
    .slice(0, 5);

  // Create an object with one array per due-date heading, then fill those arrays
  // from an already sorted list. This powers the grouped task screens.
  const groupTasksByDueBucket = (taskList) => {
    const grouped = bucketsOrder.reduce((acc, bucket) => {
      acc[bucket] = [];
      return acc;
    }, {});

    taskList.forEach((task) => {
      const bucket = getDueDateBucket(task.dueMonth, task.dueDay);

      if (grouped[bucket]) {
        grouped[bucket].push(task);
      } else {
        grouped["No Due Date"].push(task);
      }
    });

    return grouped;
  };

  const groupedTasks = groupTasksByDueBucket(sortedTodoTasks);
  const groupedInProgressTasks = groupTasksByDueBucket(sortedInProgressTasks);

  const resetFilters = () => {
    setSearchTerm("");
    setFilterCourse("ALL");
    setFilterPriority("ALL");
    setFilterDueBucket("ALL");
    setFilterRepeat("ALL");
  };

  // A recommendation click clears filters so the target cannot be hidden,
  // opens its notes, changes tabs, and waits two animation frames for React to
  // render the correct task screen before smoothly scrolling the card into view.
  const handleRecommendedTaskClick = (taskId) => {
    const targetTask = tasks.find((task) => task.id === taskId);
    const targetTab =
      getTaskStatus(targetTask) === "inProgress" ? "inProgress" : "todo";

    resetFilters();
    setExpandedTaskId(taskId);
    setCurrentTab(targetTab);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById(`${targetTab}-task-${taskId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    });
  };

  // These small render helpers keep the identical filter interface shared by
  // the To Do and Completed tabs in one place.
  const renderFilterToggle = () => (
    <button
      type="button"
      className="filter-bar"
      onClick={() => setFiltersOpen((prev) => !prev)}
    >
      <span>🔎 Filter Assignments</span>
      <span>{filtersOpen ? "▲ Hide" : "▼ Show"}</span>
    </button>
  );

  const renderFilterControls = () => {
    if (!filtersOpen) return null;

    return (
      <div className="card filter-controls-card">
        <input
          type="text"
          placeholder="Search by title, course, or notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="filter-grid">
          <div>
            <label>Course:</label>
            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
            >
              <option value="ALL">All Courses</option>
              {courses.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Priority:</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="ALL">All Priorities</option>
              <option value="HIGH">High</option>
              <option value="MED">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div>
            <label>Due:</label>
            <select
              value={filterDueBucket}
              onChange={(e) => setFilterDueBucket(e.target.value)}
            >
              <option value="ALL">All Due Dates</option>
              {bucketsOrder.map((bucket) => (
                <option key={bucket} value={bucket}>
                  {bucket}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Repeat:</label>
            <select
              value={filterRepeat}
              onChange={(e) => setFilterRepeat(e.target.value)}
            >
              <option value="ALL">All Repeat Types</option>
              <option value="NONE">Does not repeat</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={resetFilters}
          style={{
            marginTop: "12px",
            padding: "8px 12px",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Reset Filters
        </button>
      </div>
    );
  };

  /**
   * Compact checklist progress.
   * This is intentionally only one line so collapsed cards stay calm and tidy.
   */
  const renderSubtaskProgressLine = (task, extraClassName = "") => {
    const progress = getSubtaskProgress(task);

    if (!progress) return null;

    return (
      <p className={`subtask-progress-line ${extraClassName}`.trim()}>
        {progress.label}
      </p>
    );
  };

  /**
   * Full checklist shown only in expanded cards.
   * Completed tasks show the checklist as read-only; active tasks can be checked
   * off directly from To Do, In Progress, or the selected calendar day.
   */
  const renderSubtaskChecklist = (task) => {
    const subtasks = getSafeSubtasks(task);
    const progress = getSubtaskProgress(task);
    const isReadOnly = getTaskStatus(task) === "completed";

    if (subtasks.length === 0) return null;

    return (
      <div className="subtask-checklist-panel">
        <div className="subtask-checklist-header">
          <span>Finish checklist</span>
          <span>{progress?.label}</span>
        </div>

        <ul className="subtask-checklist-list">
          {subtasks.map((subtask) => (
            <li key={subtask.id} className="subtask-checklist-item">
              <label>
                <input
                  type="checkbox"
                  checked={subtask.isDone}
                  disabled={isReadOnly}
                  onChange={() => handleSubtaskToggle(task.id, subtask.id)}
                />
                <span>{subtask.text}</span>
              </label>
            </li>
          ))}
        </ul>

        {!isReadOnly && (
          <p className="subtask-checklist-hint">
            Checking every step automatically completes this assignment.
          </p>
        )}
      </div>
    );
  };

  // Dashboard summary values. Only incomplete work contributes to the active,
  // overdue, due-today, and remaining-workload statistics.
  const activeTasksCount = tasks.filter(
    (task) => getTaskStatus(task) !== "completed",
  ).length;

  const overdueTasksCount = tasks.filter(
    (task) =>
      getTaskStatus(task) !== "completed" &&
      getDueDateBucket(task.dueMonth, task.dueDay) === "Overdue 🚨",
  ).length;

  const dueTodayCount = tasks.filter(
    (task) =>
      getTaskStatus(task) !== "completed" &&
      getDueDateBucket(task.dueMonth, task.dueDay) === "Due Today ⏰",
  ).length;

  const totalEstimatedMinutes = tasks
    .filter((task) => getTaskStatus(task) !== "completed")
    .reduce((total, task) => total + (Number(task.estimatedMinutes) || 0), 0);

  const estimatedHours = Math.floor(totalEstimatedMinutes / 60);
  const estimatedMinutesLeft = totalEstimatedMinutes % 60;

  // ---------------------------------------------------------------------------
  // USER INTERFACE (JSX)
  // ---------------------------------------------------------------------------
  // JSX resembles HTML but can insert JavaScript inside braces. Expressions
  // such as currentTab === "todo" conditionally show only the selected screen.
  return (
    <div className={`App ${theme}`}>
      <div className="app-shell">
        {/* The header is always visible and identifies the active local profile. */}
        <header className="hero-card">
          <div>
            <p className="eyebrow">Student Productivity Hub</p>
            <h1 className="app-title">🎓 TaskAcadia</h1>
            <p className="hero-subtitle">
              Organize assignments, track deadlines, manage courses, and plan
              your workload.
            </p>
          </div>

          <div className="user-pill">
            {currentUser ? `Signed in as ${currentUser}` : "Guest Mode"}
          </div>
        </header>

        {/*
          Navigation changes currentTab. The active class lets CSS highlight the
          selected view; signing out and theme switching are also available here.
        */}
        <div className="tab-row">
          <button
            className={`tab-button ${currentTab === "dashboard" ? "active" : ""}`}
            onClick={() => setCurrentTab("dashboard")}
          >
            Dashboard
          </button>

          <button
            className={`tab-button ${currentTab === "todo" ? "active" : ""}`}
            onClick={() => setCurrentTab("todo")}
          >
            To Do
          </button>

          <button
            className={`tab-button ${currentTab === "inProgress" ? "active" : ""}`}
            onClick={() => setCurrentTab("inProgress")}
          >
            In Progress
          </button>

          <button
            className={`tab-button ${currentTab === "completed" ? "active" : ""}`}
            onClick={() => setCurrentTab("completed")}
          >
            Completed
          </button>

          <button
            className={`tab-button ${currentTab === "calendar" ? "active" : ""}`}
            onClick={() => setCurrentTab("calendar")}
          >
            📅 Calendar
          </button>

          <button
            className={`tab-button ${currentTab === "signin" ? "active" : ""}`}
            onClick={() => setCurrentTab("signin")}
          >
            {currentUser ? "Switch User" : "Sign In"}
          </button>

          {currentUser && (
            <button className="btn btn-danger" onClick={handleSignOut}>
              Sign Out
            </button>
          )}

          <button className="btn btn-secondary" onClick={toggleTheme}>
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
        </div>

        {/*
          DASHBOARD VIEW
          Includes quick statistics, recommendations, assignment creation, and
          course customization. It does not replace the dedicated task tabs.
        */}
        {currentTab === "dashboard" && (
          <div>
            {/* Four summary cards calculated from the current task array. */}
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Active</span>
                <strong>{activeTasksCount}</strong>
                <p>Assignments left</p>
              </div>

              <div className="stat-card">
                <span className="stat-label">Due Today</span>
                <strong>{dueTodayCount}</strong>
                <p>Need attention</p>
              </div>

              <div className="stat-card">
                <span className="stat-label">Overdue</span>
                <strong>{overdueTasksCount}</strong>
                <p>Past deadline</p>
              </div>

              <div className="stat-card">
                <span className="stat-label">Workload</span>
                <strong>
                  {estimatedHours}h {estimatedMinutesLeft}m
                </strong>
                <p>Estimated remaining</p>
              </div>
            </div>

            {/* Clicking a recommendation opens that task in the To Do view. */}
            <section
              className="recommended-plan-card"
              aria-labelledby="recommended-plan-title"
            >
              <div className="recommended-plan-header">
                <div>
                  <p className="recommended-plan-eyebrow">
                    Suggested next steps
                  </p>
                  <h2 id="recommended-plan-title">
                    Recommended Plan of Attack
                  </h2>
                </div>
                <span className="recommended-plan-count">
                  Top {recommendedTasks.length}
                </span>
              </div>

              {recommendedTasks.length === 0 ? (
                <p className="recommended-plan-empty">
                  You have no incomplete assignments. Nice work!
                </p>
              ) : (
                <ol className="recommended-plan-list">
                  {recommendedTasks.map((task, index) => {
                    const estimatedMinutes = getRecommendationEstimate(task);
                    const taskStatus = getTaskStatus(task);

                    return (
                      <li key={task.id} className="recommended-plan-item">
                        <button
                          type="button"
                          className="recommended-plan-button"
                          onClick={() => handleRecommendedTaskClick(task.id)}
                          aria-label={`Open ${task.title} in the To Do list`}
                        >
                          <span
                            className="recommended-plan-rank"
                            aria-hidden="true"
                          >
                            {index + 1}
                          </span>

                          <div className="recommended-plan-content">
                            <div className="recommended-plan-title-row">
                              <strong>{task.title}</strong>
                              <span
                                className="recommended-plan-course"
                                style={{
                                  backgroundColor: getCourseColor(task.course),
                                  color: getTextColorForCourse(task.course),
                                }}
                              >
                                {task.course}
                              </span>
                            </div>

                            <div className="recommended-plan-details">
                              <span>
                                {getDueDateBucket(task.dueMonth, task.dueDay)}
                              </span>
                              <span>
                                {task.priority || "No priority"} priority
                              </span>
                              <span>
                                {Number.isFinite(estimatedMinutes)
                                  ? `${estimatedMinutes} min`
                                  : "No time estimate"}
                              </span>
                              {taskStatus === "inProgress" && (
                                <span>In progress</span>
                              )}
                            </div>

                            {renderSubtaskProgressLine(
                              task,
                              "recommended-plan-progress",
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {/* Collapsible form for creating a new assignment. */}
            <div className="card card-container">
              <div className="assignment-header-row">
                <h3>➕ Add New Assignment</h3>

                <button
                  type="button"
                  className="btn btn-secondary assignment-toggle-button"
                  onClick={() => setAddAssignmentOpen((prev) => !prev)}
                >
                  {addAssignmentOpen ? "Minimize" : "Open"}
                </button>
              </div>

              {addAssignmentOpen && (
                <form onSubmit={handleAddTask} className="card-form">
                  <label>Assignment Name:</label>
                  <input
                    type="text"
                    placeholder="e.g., Read Chapter 4"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                  />

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "8px",
                    }}
                  >
                    <label>Course:</label>
                    <button
                      type="button"
                      onClick={() => setIsCustomCourse(!isCustomCourse)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--button-primary-bg, #007bff)",
                        cursor: "pointer",
                        fontSize: "12px",
                        textDecoration: "underline",
                      }}
                    >
                      {isCustomCourse
                        ? "Select Existing Course"
                        : "➕ Add Custom Course"}
                    </button>
                  </div>

                  {isCustomCourse ? (
                    <input
                      type="text"
                      placeholder="Type new course name (e.g., AP Psychology)"
                      value={customCourseName}
                      onChange={(e) => setCustomCourseName(e.target.value)}
                    />
                  ) : (
                    <select
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                    >
                      <option value="">Select a course</option>
                      {courses.map((course) => (
                        <option key={course} value={course}>
                          {course}
                        </option>
                      ))}
                    </select>
                  )}

                  <label>Due Date:</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <select
                      value={dueMonth}
                      onChange={(e) => setDueMonth(e.target.value)}
                    >
                      <option value="">Month</option>
                      {monthNames.map((m, idx) => (
                        <option
                          key={m}
                          value={String(idx + 1).padStart(2, "0")}
                        >
                          {m}
                        </option>
                      ))}
                    </select>
                    <select
                      value={dueDay}
                      onChange={(e) => setDueDay(e.target.value)}
                    >
                      <option value="">Day</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={String(d).padStart(2, "0")}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label>Due Time (12-hour):</label>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={dueHour}
                      onChange={(e) => setDueHour(e.target.value)}
                      style={{ width: "80px" }}
                    />
                    <select
                      value={dueAmPm}
                      onChange={(e) => setDueAmPm(e.target.value)}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>

                  <label>Estimated Minutes:</label>
                  <input
                    type="number"
                    placeholder="e.g., 45"
                    value={estTime}
                    onChange={(e) => setEstTime(e.target.value)}
                  />

                  <label>Priority:</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="LOW">Low</option>
                    <option value="MED">Medium</option>
                    <option value="HIGH">High</option>
                  </select>

                  <label>Repeat:</label>
                  <select
                    value={repeatFrequency}
                    onChange={(e) => setRepeatFrequency(e.target.value)}
                  >
                    <option value="NONE">Does not repeat</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>

                  <div className="subtask-form-section">
                    <div>
                      <label>Optional Checklist Steps:</label>
                      <p className="subtask-form-hint">
                        Break the assignment into smaller pieces. Leave this
                        blank if the assignment does not need steps.
                      </p>
                    </div>

                    <div className="subtask-form-row">
                      <input
                        type="text"
                        placeholder="e.g., Find quotes"
                        value={newSubtaskText}
                        onChange={(e) => setNewSubtaskText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddDraftSubtask();
                          }
                        }}
                      />

                      <button
                        type="button"
                        className="btn btn-secondary subtask-add-button"
                        onClick={handleAddDraftSubtask}
                      >
                        Add Step
                      </button>
                    </div>

                    {draftSubtasks.length > 0 && (
                      <ul className="subtask-draft-list">
                        {draftSubtasks.map((subtask) => (
                          <li key={subtask.id} className="subtask-draft-item">
                            <span>{subtask.text}</span>
                            <button
                              type="button"
                              className="subtask-remove-button"
                              onClick={() =>
                                handleRemoveDraftSubtask(subtask.id)
                              }
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isFormInvalid}
                    style={{
                      padding: "10px",
                      borderRadius: "4px",
                      marginTop: "10px",
                      cursor: isFormInvalid ? "not-allowed" : "pointer",
                      opacity: isFormInvalid ? 0.6 : 1,
                    }}
                  >
                    Add Assignment
                  </button>
                </form>
              )}
              <div
                className="course-colors-section"
                style={{ marginTop: "25px" }}
              >
                <div className="course-colors-header-row">
                  <h3>🎨 Course Colors</h3>

                  <button
                    type="button"
                    className="btn btn-secondary course-colors-toggle-button"
                    onClick={() => setCourseColorsOpen((prev) => !prev)}
                  >
                    {courseColorsOpen ? "Minimize" : "Open"}
                  </button>
                </div>

                {courseColorsOpen && (
                  <>
                    <p className="hint-text">
                      Customize course colors or delete courses you no longer
                      need. Assignments from deleted courses move to "Other".
                    </p>

                    {courses.map((course) => (
                      <div
                        key={course}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          marginBottom: "10px",
                          padding: "8px",
                          borderRadius: "8px",
                          backgroundColor: "var(--card-bg)",
                        }}
                      >
                        <span
                          style={{
                            backgroundColor: getCourseColor(course),
                            color: getTextColorForCourse(course),
                            padding: "5px 10px",
                            borderRadius: "999px",
                            fontWeight: "600",
                          }}
                        >
                          {course}
                        </span>

                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="color"
                            value={getCourseColor(course)}
                            onChange={(e) =>
                              handleCourseColorChange(course, e.target.value)
                            }
                          />

                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={course === "Other"}
                            onClick={() => handleDeleteCourse(course)}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "4px",
                              cursor:
                                course === "Other" ? "not-allowed" : "pointer",
                              opacity: course === "Other" ? 0.5 : 1,
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/*
          TAB CONTENT
          Only one of the following sections is rendered at a time. Keeping each
          condition near its markup makes the screen-to-state relationship clear.
        */}
        <div>
          {/* TO DO: filtered incomplete tasks grouped into due-date buckets. */}
          {currentTab === "todo" && (
            <div>
              {renderFilterToggle()}

              <h3>📝 To Do ({todoTasks.length})</h3>

              {renderFilterControls()}

              {todoTasks.length === 0 ? (
                <p className="placeholder-text">
                  No pending assignments match your filters.
                </p>
              ) : (
                <div>
                  {bucketsOrder.map((bucketName) => {
                    const tasksInBucket = groupedTasks[bucketName];
                    if (tasksInBucket.length === 0) return null;

                    return (
                      <div
                        key={bucketName}
                        className="bucket-section"
                        style={{ marginTop: "20px" }}
                      >
                        <h4
                          className="bucket-title"
                          style={{
                            borderBottom: "1px solid #ccc",
                            paddingBottom: "4px",
                            marginBottom: "10px",
                            color: "var(--text-color)",
                          }}
                        >
                          {bucketName}
                        </h4>
                        <ul
                          className="task-list"
                          style={{ paddingLeft: 0, listStyle: "none" }}
                        >
                          {tasksInBucket.map((task) => (
                            <li
                              key={task.id}
                              id={`todo-task-${task.id}`}
                              className={`task-card${task.priority === "HIGH" ? " task-card-high" : ""}${expandedTaskId === task.id ? " expanded" : ""}`}
                              onClick={() => toggleTaskExpansion(task.id)}
                            >
                              <div>
                                <strong>{task.title}</strong>
                                <span
                                  className="course-name"
                                  style={{
                                    backgroundColor: getCourseColor(
                                      task.course,
                                    ),
                                    color: getTextColorForCourse(task.course),
                                    padding: "4px 8px",
                                    borderRadius: "999px",
                                    fontWeight: "600",
                                  }}
                                >
                                  {task.course}
                                </span>
                                <div className="task-details">
                                  {formatTaskDetails(task)}
                                </div>
                                {renderSubtaskProgressLine(task)}
                              </div>

                              <div className="task-actions">
                                <button
                                  className="btn btn-secondary status-action-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartTask(task.id);
                                  }}
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Start
                                </button>

                                <button
                                  className="btn btn-primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleComplete(task.id);
                                  }}
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Complete ✅
                                </button>

                                <button
                                  className="btn btn-secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditStart(task);
                                  }}
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                  }}
                                >
                                  ✏️ Edit
                                </button>

                                <button
                                  className="btn btn-danger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(task.id);
                                  }}
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Delete
                                </button>
                              </div>

                              {expandedTaskId === task.id && (
                                <div
                                  className="task-notes-panel"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <label
                                    htmlFor={`notes-${task.id}`}
                                    className="task-notes-label"
                                  >
                                    Notes
                                  </label>
                                  <textarea
                                    id={`notes-${task.id}`}
                                    value={task.notes || ""}
                                    onChange={(e) =>
                                      handleNoteChange(task.id, e.target.value)
                                    }
                                    placeholder="Type notes for this assignment..."
                                    className="task-note-input"
                                  />

                                  {renderSubtaskChecklist(task)}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* IN PROGRESS: started assignments that are still incomplete. */}
          {currentTab === "inProgress" && (
            <div className="in-progress-tab-section">
              {renderFilterToggle()}

              <h3>In Progress ({inProgressTasks.length})</h3>

              {renderFilterControls()}

              {inProgressTasks.length === 0 ? (
                <p className="placeholder-text">
                  No in-progress assignments match your filters.
                </p>
              ) : (
                <div>
                  {bucketsOrder.map((bucketName) => {
                    const tasksInBucket = groupedInProgressTasks[bucketName];
                    if (tasksInBucket.length === 0) return null;

                    return (
                      <div
                        key={bucketName}
                        className="bucket-section"
                        style={{ marginTop: "20px" }}
                      >
                        <h4
                          className="bucket-title"
                          style={{
                            borderBottom: "1px solid #ccc",
                            paddingBottom: "4px",
                            marginBottom: "10px",
                            color: "var(--text-color)",
                          }}
                        >
                          {bucketName}
                        </h4>
                        <ul
                          className="task-list"
                          style={{ paddingLeft: 0, listStyle: "none" }}
                        >
                          {tasksInBucket.map((task) => (
                            <li
                              key={task.id}
                              id={`inProgress-task-${task.id}`}
                              className={`task-card in-progress-task-card${task.priority === "HIGH" ? " task-card-high" : ""}${expandedTaskId === task.id ? " expanded" : ""}`}
                              onClick={() => toggleTaskExpansion(task.id)}
                            >
                              <div>
                                <strong>{task.title}</strong>
                                <span
                                  className="course-name"
                                  style={{
                                    backgroundColor: getCourseColor(
                                      task.course,
                                    ),
                                    color: getTextColorForCourse(task.course),
                                    padding: "4px 8px",
                                    borderRadius: "999px",
                                    fontWeight: "600",
                                  }}
                                >
                                  {task.course}
                                </span>
                                <span className="in-progress-status-pill">
                                  In Progress
                                </span>
                                <div className="task-details">
                                  {formatTaskDetails(task)}
                                </div>
                                {renderSubtaskProgressLine(task)}
                              </div>

                              <div className="task-actions">
                                <button
                                  className="btn btn-warning status-action-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveToTodo(task.id);
                                  }}
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Move to To Do
                                </button>

                                <button
                                  className="btn btn-primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleComplete(task.id);
                                  }}
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Complete ✅
                                </button>

                                <button
                                  className="btn btn-secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditStart(task);
                                  }}
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                  }}
                                >
                                  ✏️ Edit
                                </button>

                                <button
                                  className="btn btn-danger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(task.id);
                                  }}
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Delete
                                </button>
                              </div>

                              {expandedTaskId === task.id && (
                                <div
                                  className="task-notes-panel"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <label
                                    htmlFor={`in-progress-notes-${task.id}`}
                                    className="task-notes-label"
                                  >
                                    Notes
                                  </label>
                                  <textarea
                                    id={`in-progress-notes-${task.id}`}
                                    value={task.notes || ""}
                                    onChange={(e) =>
                                      handleNoteChange(task.id, e.target.value)
                                    }
                                    placeholder="Type notes for this assignment..."
                                    className="task-note-input"
                                  />

                                  {renderSubtaskChecklist(task)}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* COMPLETED: finished tasks with undo, edit, delete, and notes. */}
          {currentTab === "completed" && (
            <div>
              {renderFilterToggle()}

              <h3>✅ Completed ({completedTasks.length})</h3>

              {renderFilterControls()}

              {completedTasks.length === 0 ? (
                <p className="placeholder-text">
                  No completed assignments match your filters.
                </p>
              ) : (
                <ul
                  className="task-list"
                  style={{ paddingLeft: 0, listStyle: "none" }}
                >
                  {completedTasks.map((task) => (
                    <li
                      key={task.id}
                      className={`task-card${expandedTaskId === task.id ? " expanded" : ""}`}
                      onClick={() => toggleTaskExpansion(task.id)}
                    >
                      <div>
                        <strong>{task.title}</strong>
                        <span
                          className="course-name"
                          style={{
                            backgroundColor: getCourseColor(task.course),
                            color: getTextColorForCourse(task.course),
                            padding: "4px 8px",
                            borderRadius: "999px",
                            fontWeight: "600",
                          }}
                        >
                          {task.course}
                        </span>
                        <div className="task-details">
                          {formatTaskDetails(task)}
                        </div>
                        {renderSubtaskProgressLine(task)}
                      </div>
                      <div className="task-actions">
                        <button
                          className="btn btn-warning"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUndo(task.id);
                          }}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          Mark Undone
                        </button>

                        <button
                          className="btn btn-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditStart(task);
                          }}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          ✏️ Edit
                        </button>

                        <button
                          className="btn btn-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(task.id);
                          }}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>

                      {expandedTaskId === task.id && (
                        <div
                          className="task-notes-panel"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label
                            htmlFor={`notes-${task.id}`}
                            className="task-notes-label"
                          >
                            Notes
                          </label>
                          <textarea
                            id={`notes-${task.id}`}
                            value={task.notes || ""}
                            onChange={(e) =>
                              handleNoteChange(task.id, e.target.value)
                            }
                            placeholder="Type notes for this assignment..."
                            className="task-note-input"
                          />

                          {renderSubtaskChecklist(task)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {/* CALENDAR: month overview plus tasks matching the selected day. */}
          {currentTab === "calendar" && (
            <div
              className="panel-card resizable-panel calendar-panel"
              style={{ marginTop: "10px" }}
            >
              <div className="panel-header">
                <h3>📅 Assignment Calendar</h3>

                <button
                  type="button"
                  className="btn btn-secondary panel-mini-button"
                  onClick={() => setCalendarOpen((prev) => !prev)}
                >
                  {calendarOpen ? "Minimize" : "Open"}
                </button>
              </div>

              {calendarOpen && (
                <>
                  <Calendar
                    onChange={setSelectedDate}
                    value={selectedDate}
                    tileContent={({ date }) => {
                      const taskForDay = tasks.find(
                        (task) =>
                          Number(task.dueMonth) === date.getMonth() + 1 &&
                          Number(task.dueDay) === date.getDate(),
                      );

                      return taskForDay ? (
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            backgroundColor: getCourseColor(taskForDay.course),
                            margin: "0 auto",
                            marginTop: 2,
                          }}
                        />
                      ) : null;
                    }}
                  />

                  <h4 style={{ marginTop: "20px" }}>
                    Assignments for {selectedDate.toDateString()}
                  </h4>

                  {tasks.filter(
                    (task) =>
                      Number(task.dueMonth) === selectedDate.getMonth() + 1 &&
                      Number(task.dueDay) === selectedDate.getDate(),
                  ).length === 0 ? (
                    <p className="placeholder-text">
                      No assignments due on this day.
                    </p>
                  ) : (
                    <ul
                      className="task-list"
                      style={{ paddingLeft: 0, listStyle: "none" }}
                    >
                      {tasks
                        .filter(
                          (task) =>
                            Number(task.dueMonth) ===
                              selectedDate.getMonth() + 1 &&
                            Number(task.dueDay) === selectedDate.getDate(),
                        )
                        .map((task) => (
                          <li
                            key={task.id}
                            className={`task-card calendar-task-card${expandedTaskId === task.id ? " expanded" : ""}`}
                            onClick={() => toggleTaskExpansion(task.id)}
                          >
                            <div>
                              <strong>{task.title}</strong> —{" "}
                              <span
                                className="course-name"
                                style={{
                                  backgroundColor: getCourseColor(task.course),
                                  color: getTextColorForCourse(task.course),
                                  padding: "4px 8px",
                                  borderRadius: "999px",
                                  fontWeight: "600",
                                }}
                              >
                                {task.course}
                              </span>
                              <div className="task-details">
                                {formatTaskDetails(task)}
                              </div>
                              {renderSubtaskProgressLine(task)}
                              <p
                                className="hint-text"
                                style={{ marginTop: "8px", fontSize: "13px" }}
                              >
                                Click to view or edit notes
                              </p>
                              <div className="task-actions">
                                <button
                                  className="btn btn-secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditStart(task);
                                  }}
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                  }}
                                >
                                  ✏️ Edit Assignment
                                </button>
                              </div>
                            </div>

                            {expandedTaskId === task.id && (
                              <div
                                className="task-notes-panel"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <label
                                  htmlFor={`calendar-notes-${task.id}`}
                                  className="task-notes-label"
                                >
                                  Notes
                                </label>

                                <textarea
                                  id={`calendar-notes-${task.id}`}
                                  value={task.notes || ""}
                                  onChange={(e) =>
                                    handleNoteChange(task.id, e.target.value)
                                  }
                                  placeholder="Type notes for this assignment..."
                                  className="task-note-input"
                                />

                                {renderSubtaskChecklist(task)}
                              </div>
                            )}
                          </li>
                        ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
          {/* SIGN IN: selects a browser-local username profile. */}
          {currentTab === "signin" && (
            <div className="card card-container" style={{ marginTop: "10px" }}>
              <h3>🔐 Sign In</h3>
              <form onSubmit={handleSignIn} className="card-form">
                <input
                  placeholder="Username"
                  value={signInName}
                  onChange={(e) => setSignInName(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: "8px 12px", borderRadius: "4px" }}
                >
                  Sign In
                </button>
              </form>
              <p className="hint-text">
                Signing in will load and save assignments under your username in
                local storage.
              </p>
            </div>
          )}
        </div>
      </div>
      {/*
        EDIT MODAL
        Rendered above every tab only while editingTask contains a temporary copy.
        Clicking the dark backdrop cancels; clicks inside stop propagation so the
        modal remains open while the user interacts with its fields.
      */}
      {editingTask && (
        <div className="modal-backdrop" onClick={handleEditCancel}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <div>
                <p className="eyebrow modal-eyebrow">Edit Assignment</p>
                <h2>✏️ {editingTask.title || "Untitled Assignment"}</h2>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={handleEditCancel}
              >
                ×
              </button>
            </div>

            <div className="edit-modal-grid">
              <div className="edit-field edit-field-full">
                <label>Assignment Name</label>
                <input
                  type="text"
                  value={editingTask?.title || ""}
                  onChange={(e) =>
                    handleEditFieldChange("title", e.target.value)
                  }
                  placeholder="Assignment name"
                />
              </div>

              <div className="edit-main-layout">
                <div className="edit-details-grid">
                  <div className="edit-field">
                    <label>Course</label>
                    <select
                      value={editingTask.course || "Other"}
                      onChange={(e) =>
                        handleEditFieldChange("course", e.target.value)
                      }
                    >
                      {courses.map((course) => (
                        <option key={course} value={course}>
                          {course}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="edit-field">
                    <label>Priority</label>
                    <select
                      value={editingTask.priority || "MED"}
                      onChange={(e) =>
                        handleEditFieldChange("priority", e.target.value)
                      }
                    >
                      <option value="LOW">Low</option>
                      <option value="MED">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>

                  <div className="edit-field">
                    <label>Due Month</label>
                    <select
                      value={editingTask.dueMonth || ""}
                      onChange={(e) =>
                        handleEditFieldChange("dueMonth", e.target.value)
                      }
                    >
                      <option value="">No month</option>
                      {monthNames.map((month, index) => (
                        <option
                          key={month}
                          value={String(index + 1).padStart(2, "0")}
                        >
                          {month}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="edit-field">
                    <label>Due Day</label>
                    <select
                      value={editingTask.dueDay || ""}
                      onChange={(e) =>
                        handleEditFieldChange("dueDay", e.target.value)
                      }
                    >
                      <option value="">No day</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(
                        (day) => (
                          <option
                            key={day}
                            value={String(day).padStart(2, "0")}
                          >
                            {day}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="edit-field">
                    <label>Due Hour</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={editingTask.dueHour || "11"}
                      onChange={(e) =>
                        handleEditFieldChange("dueHour", e.target.value)
                      }
                    />
                  </div>

                  <div className="edit-field">
                    <label>AM / PM</label>
                    <select
                      value={editingTask.dueAmPm || "PM"}
                      onChange={(e) =>
                        handleEditFieldChange("dueAmPm", e.target.value)
                      }
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>

                  <div className="edit-field">
                    <label>Estimated Minutes</label>
                    <input
                      type="number"
                      min="0"
                      value={editingTask.estimatedMinutes || ""}
                      onChange={(e) =>
                        handleEditFieldChange(
                          "estimatedMinutes",
                          e.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="edit-field">
                    <label>Repeat</label>
                    <select
                      value={editingTask.repeat || "NONE"}
                      onChange={(e) =>
                        handleEditFieldChange("repeat", e.target.value)
                      }
                    >
                      <option value="NONE">Does not repeat</option>
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                    </select>
                  </div>
                </div>

                <div className="edit-field edit-notes-side">
                  <label>Notes</label>
                  <textarea
                    value={editingTask.notes || ""}
                    onChange={(e) =>
                      handleEditFieldChange("notes", e.target.value)
                    }
                    placeholder="Add notes, reminders, links, rubric details, or study instructions..."
                  />
                </div>
              </div>

              <div className="edit-field edit-field-full edit-subtask-section">
                <div>
                  <label>Checklist Steps</label>
                  <p className="subtask-form-hint">
                    Optional smaller steps that show up when the assignment card
                    is expanded. If every step is checked, the assignment
                    completes automatically.
                  </p>
                </div>

                <div className="subtask-form-row">
                  <input
                    type="text"
                    placeholder="e.g., Write intro"
                    value={editSubtaskText}
                    onChange={(e) => setEditSubtaskText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddEditSubtask();
                      }
                    }}
                  />

                  <button
                    type="button"
                    className="btn btn-secondary subtask-add-button"
                    onClick={handleAddEditSubtask}
                  >
                    Add Step
                  </button>
                </div>

                {getSafeSubtasks(editingTask).length > 0 ? (
                  <ul className="edit-subtask-list">
                    {getSafeSubtasks(editingTask).map((subtask) => (
                      <li key={subtask.id} className="edit-subtask-item">
                        <input
                          type="checkbox"
                          checked={subtask.isDone}
                          onChange={() => handleEditSubtaskToggle(subtask.id)}
                        />

                        <input
                          type="text"
                          value={subtask.text}
                          onChange={(e) =>
                            handleEditSubtaskTextChange(
                              subtask.id,
                              e.target.value,
                            )
                          }
                        />

                        <button
                          type="button"
                          className="subtask-remove-button"
                          onClick={() => handleRemoveEditSubtask(subtask.id)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="subtask-form-hint">
                    No checklist steps yet.
                  </p>
                )}
              </div>

              <label className="edit-checkbox edit-field-full">
                <input
                  type="checkbox"
                  checked={Boolean(editingTask.isCompleted)}
                  onChange={(e) =>
                    handleEditFieldChange("isCompleted", e.target.checked)
                  }
                />
                Mark as completed
              </label>
            </div>
            <div className="edit-modal-actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleEditCancel}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleEditSave}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
