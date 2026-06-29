
import { useState, useEffect } from 'react'
import './App.css'

function getSystemPreference() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

function App() {
  // 1. Courses list shown in the course dropdown.
  //    You can update this array to add or remove course options.
  const [courses, setCourses] = useState(['AP Stat', 'British Literature', 'Calculus H', 'APES'])
  
  // 2. Form input state for the Add Assignment form.
  //    Each field is controlled by React so we can reset and validate them.
  const [taskName, setTaskName] = useState('')
  const [selectedCourse, setSelectedCourse] = useState('')
  const [dueMonth, setDueMonth] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [dueHour, setDueHour] = useState('11') // 12-hour clock hour
  const [dueAmPm, setDueAmPm] = useState('PM')
  const [estTime, setEstTime] = useState('')
  const [priority, setPriority] = useState('MED')

  // 3. Task list state and UI tab state.
  //    tasks stores all assignments, currentTab decides which view is visible.
  const [tasks, setTasks] = useState([])
  const [currentTab, setCurrentTab] = useState('dashboard')
  const [expandedTaskId, setExpandedTaskId] = useState(null)

  // 4. User authentication state.
  //    currentUser is the signed-in username saved in localStorage.
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return localStorage.getItem('currentUser') || ''
    } catch (error) {
      console.error('Error reading currentUser from localStorage:', error)
      return ''
    }
  })
  const [signInName, setSignInName] = useState('')

  // Track whether the UI is in light mode or dark mode.
  const [theme, setTheme] = useState(() => {
    try {
      const storedTheme = localStorage.getItem('theme')
      return storedTheme ? storedTheme : getSystemPreference()
    } catch (error) {
      console.error('Error reading theme from localStorage:', error)
      return getSystemPreference()
    }
  })

  // Helper values used across render and event handlers.
  // monthNames lets us show short month labels for due dates in the UI.
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  // currentStorageKey is the LocalStorage key used for the currently signed-in user.
  //   Example: tasks_john or tasks_guest if no user is signed in.
  const currentStorageKey = currentUser ? `tasks_${currentUser}` : 'tasks_guest'

  // formatTaskDetails creates the text shown for a task's date, time, estimate, and priority.
  const formatTaskDetails = (task) => {
    const hasDate = task.dueMonth && task.dueDay
    const monthLabel = hasDate ? monthNames[Number(task.dueMonth) - 1] : null
    const dateLabel = hasDate ? `${monthLabel} ${Number(task.dueDay)}` : 'No date'
    const timeLabel = task.dueHour ? `${task.dueHour} ${task.dueAmPm || ''}` : 'No time'
    return `📅 Due: ${dateLabel} at ${timeLabel} | ⏱️ Est: ${task.estimatedMinutes || 0} mins | ⚠️ Priority: ${task.priority}`
  }

  // Apply theme changes to the DOM and persist the chosen theme.
  // The [data-theme] attribute is used by App.css to switch color variables.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('theme', theme)
    } catch (error) {
      console.error('Error writing theme to localStorage:', error)
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'))
  }

  // 5. Function that handles clicking the "Add Assignment" button.
  //    It creates a new task object, saves it to state, and persists it.
  const handleAddTask = (e) => {
    e.preventDefault()
    if (!taskName || !selectedCourse) return // Require name and course

    const newTask = {
      id: Date.now(), // Temporary unique ID
      title: taskName,
      course: selectedCourse,
      dueMonth: dueMonth,
      dueDay: dueDay,
      dueHour: dueHour,
      dueAmPm: dueAmPm,
      estimatedMinutes: estTime,
      priority: priority,
      isCompleted: false,
      notes: ''
    }

    // Add the new task and persist the updated list for the current user.
    setTasks(prev => {
      const updated = [...prev, newTask]
      try { localStorage.setItem(currentStorageKey, JSON.stringify(updated)) } catch (error) {
        console.error('Failed to save tasks when adding a new task:', error)
      }
      return updated
    })
    // Reset all form inputs to defaults
    setTaskName('')
    setSelectedCourse('')
    setDueMonth('')
    setDueDay('')
    setDueHour('11')
    setDueAmPm('PM')
    setEstTime('')
    setPriority('MED')
  }

  const saveTasksForCurrentUser = (updated) => {
    try { localStorage.setItem(currentStorageKey, JSON.stringify(updated)) } catch (error) {
      console.error('Failed to save tasks to localStorage:', error)
    }
  }

  const toggleTaskExpansion = (id) => {
    setExpandedTaskId(prev => (prev === id ? null : id))
  }

  const handleNoteChange = (id, notes) => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, notes } : t)
      saveTasksForCurrentUser(updated)
      return updated
    })
  }

  // Mark a task as completed, then save the updated tasks for the current user.
  const handleComplete = (id) => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, isCompleted: true } : t)
      saveTasksForCurrentUser(updated)
      return updated
    })
  }

  // Move a task back from completed to active and save the change.
  const handleUndo = (id) => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, isCompleted: false } : t)
      saveTasksForCurrentUser(updated)
      return updated
    })
  }

  // Permanently delete a task from the list and save the new list.
  const handleDelete = (id) => {
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== id)
      saveTasksForCurrentUser(updated)
      return updated
    })
  }

  // Whenever the signed-in user changes, reload their stored tasks from localStorage.
  useEffect(() => {
    // Load tasks when the signed-in user changes.
    // This keeps the current task list in sync with localStorage for that user.
    try {
      const raw = localStorage.getItem(currentStorageKey)
      if (raw) setTasks(JSON.parse(raw))
      else setTasks([])
    } catch (error) {
      console.error('Failed to load tasks from localStorage:', error)
      setTasks([])
    }
  }, [currentStorageKey])

  const handleSignIn = (e) => {
    e.preventDefault()
    const trimmedName = signInName.trim()
    if (!trimmedName) return
    setCurrentUser(trimmedName)
    setSignInName('')
    setCurrentTab('dashboard')
  }

  // Persist currentUser in localStorage so the same user remains signed in after refresh.
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem('currentUser', currentUser)
      } else {
        localStorage.removeItem('currentUser')
      }
    } catch (error) {
      console.error('Failed to persist currentUser to localStorage:', error)
    }
  }, [currentUser])

  const handleSignOut = () => {
    // When the user signs out, clear currentUser and fall back to guest tasks.
    setCurrentUser('')
    setCurrentTab('dashboard')
    try {
      const raw = localStorage.getItem('tasks_guest')
      if (raw) setTasks(JSON.parse(raw))
      else setTasks([])
    } catch (error) {
      console.error('Failed to load guest tasks on sign out:', error)
      setTasks([])
    }
  }

  return (
    <div className={`App ${theme}`}>
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
        <h1 className="app-title">🎓 TaskAcadia Dashboard</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p>Welcome. Track your workload here.</p>
          <div style={{ fontSize: '14px' }}>{currentUser ? `Signed in as ${currentUser}` : 'Not signed in'}</div>
        </div>

        {/* Tabs */}
        {/*
          The tab buttons switch the main page section shown below.
          Dashboard = add tasks
          To Do = active assignments
          Completed = finished assignments
          Sign In = switch or sign in user
        */}
        <div className="tab-row" style={{ display: 'flex', gap: '8px', marginTop: '12px', marginBottom: '12px' }}>
          <button className={`tab-button ${currentTab === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentTab('dashboard')}>Dashboard</button>
          <button className={`tab-button ${currentTab === 'todo' ? 'active' : ''}`} onClick={() => setCurrentTab('todo')}>To Do</button>
          <button className={`tab-button ${currentTab === 'completed' ? 'active' : ''}`} onClick={() => setCurrentTab('completed')}>Completed</button>
          <button className={`tab-button ${currentTab === 'signin' ? 'active' : ''}`} onClick={() => setCurrentTab('signin')}>{currentUser ? 'Switch User' : 'Sign In'}</button>
          {currentUser && <button className="btn btn-danger" onClick={handleSignOut}>Sign Out</button>}
          {/*
            The theme button switches light/dark mode.
            Actual button colors are defined in App.css using CSS variables.
            If you want to change the color palette, edit App.css variables such as
            --button-primary-bg, --button-danger-bg, and --button-warning-bg.
          */}
          <button className="btn btn-secondary" onClick={toggleTheme}>
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>

        {/* --- FORM SECTION TO ADD TASKS (only show on dashboard tab) --- */}
        {/*
          The dashboard tab contains the input form for new assignments.
          It only shows when currentTab is 'dashboard'.
        */}
        {currentTab === 'dashboard' && (
          <div className="card card-container">
            <h3>➕ Add New Assignment</h3>
            <form onSubmit={handleAddTask} className="card-form">
              
              <label>Assignment Name:</label>
              <input 
                type="text" 
                placeholder="e.g., Read Chapter 4" 
                value={taskName} 
                onChange={(e) => setTaskName(e.target.value)} 
              />

              <label>Course:</label>
              <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}>
                <option value="">Select a course</option>
                {courses.map(course => <option key={course} value={course}>{course}</option>)}
              </select>

              <label>Due Date:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select value={dueMonth} onChange={(e) => setDueMonth(e.target.value)}>
                  <option value="">Month</option>
                  <option value="01">Jan</option>
                  <option value="02">Feb</option>
                  <option value="03">Mar</option>
                  <option value="04">Apr</option>
                  <option value="05">May</option>
                  <option value="06">Jun</option>
                  <option value="07">Jul</option>
                  <option value="08">Aug</option>
                  <option value="09">Sep</option>
                  <option value="10">Oct</option>
                  <option value="11">Nov</option>
                  <option value="12">Dec</option>
                </select>
                <select value={dueDay} onChange={(e) => setDueDay(e.target.value)}>
                  <option value="">Day</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
                  ))}
                </select>
              </div>

              <label>Due Time (12-hour):</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="number" min="1" max="12" value={dueHour} onChange={(e) => setDueHour(e.target.value)} style={{ width: '80px' }} />
                <select value={dueAmPm} onChange={(e) => setDueAmPm(e.target.value)}>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>

              <label>Estimated Minutes:</label>
              <input type="number" placeholder="e.g., 45" value={estTime} onChange={(e) => setEstTime(e.target.value)} />

              <label>Priority:</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="LOW">Low</option>
                <option value="MED">Medium</option>
                <option value="HIGH">High</option>
              </select>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={!taskName || !selectedCourse}
                style={{
                  padding: '10px',
                  borderRadius: '4px',
                  cursor: !taskName || !selectedCourse ? 'not-allowed' : 'pointer',
                  opacity: !taskName || !selectedCourse ? 0.6 : 1
                }}
              >
                Add Assignment
              </button>
            </form>
          </div>
        )}

        {/* --- MAIN VIEW SECTION --- */}
        {/*
          This section renders one of the three task views depending on currentTab:
          - todo: pending assignments
          - completed: finished assignments
          - signin: login section
        */}
        <div>
          {currentTab === 'todo' && (
            <div>
              <h3>📝 To Do ({tasks.filter(t => !t.isCompleted).length})</h3>
              {tasks.filter(t => !t.isCompleted).length === 0 ? (
                <p className="placeholder-text">No pending assignments.</p>
              ) : (
                <ul className="task-list">
                  {tasks.filter(t => !t.isCompleted).map(task => (
                    <li
                      key={task.id}
                      className={`task-card${task.priority === 'HIGH' ? ' task-card-high' : ''}${expandedTaskId === task.id ? ' expanded' : ''}`}
                      onClick={() => toggleTaskExpansion(task.id)}
                    >
                      <div>
                        <strong>{task.title}</strong> — <span className="course-name">{task.course}</span>
                        <div className="task-details">
                          {formatTaskDetails(task)}
                        </div>
                      </div>

                      <div className="task-actions">
                        {/* Primary action and danger button colors are controlled by App.css variables. */}
                        <button 
                          className="btn btn-primary"
                          onClick={(e) => { e.stopPropagation(); handleComplete(task.id) }}
                          style={{ padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Complete ✅
                        </button>
                        <button 
                          className="btn btn-danger"
                          onClick={(e) => { e.stopPropagation(); handleDelete(task.id) }}
                          style={{ padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </div>

                      {expandedTaskId === task.id && (
                        <div className="task-notes-panel" onClick={(e) => e.stopPropagation()}>
                          <label htmlFor={`notes-${task.id}`} className="task-notes-label">Notes</label>
                          <textarea
                            id={`notes-${task.id}`}
                            value={task.notes || ''}
                            onChange={(e) => handleNoteChange(task.id, e.target.value)}
                            placeholder="Type notes for this assignment..."
                            className="task-note-input"
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {currentTab === 'completed' && (
            <div>
              <h3>✅ Completed ({tasks.filter(t => t.isCompleted).length})</h3>
              {tasks.filter(t => t.isCompleted).length === 0 ? (
                <p className="placeholder-text">No completed assignments.</p>
              ) : (
                <ul className="task-list">
                  {tasks.filter(t => t.isCompleted).map(task => (
                    <li
                      key={task.id}
                      className={`task-card${expandedTaskId === task.id ? ' expanded' : ''}`}
                      onClick={() => toggleTaskExpansion(task.id)}
                    >
                      <div>
                        <strong>{task.title}</strong> — <span className="course-name">{task.course}</span>
                        <div className="task-details">
                          {formatTaskDetails(task)}
                        </div>
                      </div>
                      <div className="task-actions">
                        {/* Warning and danger button colors map to theme variables in App.css. */}
                        <button 
                          className="btn btn-warning"
                          onClick={(e) => { e.stopPropagation(); handleUndo(task.id) }}
                          style={{ padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Mark Undone
                        </button>
                        <button 
                          className="btn btn-danger"
                          onClick={(e) => { e.stopPropagation(); handleDelete(task.id) }}
                          style={{ padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </div>

                      {expandedTaskId === task.id && (
                        <div className="task-notes-panel" onClick={(e) => e.stopPropagation()}>
                          <label htmlFor={`notes-${task.id}`} className="task-notes-label">Notes</label>
                          <textarea
                            id={`notes-${task.id}`}
                            value={task.notes || ''}
                            onChange={(e) => handleNoteChange(task.id, e.target.value)}
                            placeholder="Type notes for this assignment..."
                            className="task-note-input"
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {currentTab === 'signin' && (
            <div className="card card-container" style={{ marginTop: '10px' }}>
            {/* Sign in form for a username-based local storage profile. */}
              <h3>🔐 Sign In</h3>
              <form onSubmit={handleSignIn} className="card-form">
                <input placeholder="Username" value={signInName} onChange={(e) => setSignInName(e.target.value)} />
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 12px', borderRadius: '4px' }}>Sign In</button>
              </form>
              <p className="hint-text">Signing in will load and save assignments under your username in local storage.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App