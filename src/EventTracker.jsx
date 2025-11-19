import { db } from "./firebase";
import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Eye, EyeOff, Trash2, Bell, X, AlertCircle, LogOut } from 'lucide-react';
import { collection, doc, setDoc, getDocs, addDoc, query, where, deleteDoc, updateDoc } from "firebase/firestore";

const SUBJECTS = [
  'Operating Systems',
  'Computer Architecture',
  'Microprocessors',
  'Database Management',
  'Waste Water Management',
  'Game Theory'
];

const CLUBS = [
  'ERC',
  'BITSMUN',
  'DOSM',
  'DOPY',
  'GSOC',
  'BITSKreig',
  'MIME Club',
  'Dance Club'
];

const EventTracker = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [hiddenEvents, setHiddenEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAuthModal, setShowAuthModal] = useState(true);
  const [isSignup, setIsSignup] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [eventFilter, setEventFilter] = useState('all');

  const [authForm, setAuthForm] = useState({
    username: '',
    password: '',
    role: 'Student',
    subjects: [],
    clubs: [],
    selectedSubject: '',
    selectedClub: ''
  });

  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    type: 'personal',
    category: ''
  });

  // load all relevant collections once (minimal change from your code)
  useEffect(() => {
    async function loadData() {
      // Load users
      const usersSnapshot = await getDocs(collection(db, "users"));
      const loadedUsers = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(loadedUsers);

      // Load events
      const eventsSnapshot = await getDocs(collection(db, "events"));
      const loadedEvents = eventsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setEvents(loadedEvents);

      // Load hiddenEvents
      const hiddenSnapshot = await getDocs(collection(db, "hiddenEvents"));
      const loadedHidden = hiddenSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setHiddenEvents(loadedHidden);

      // Load notifications
      const notiSnapshot = await getDocs(collection(db, "notifications"));
      const loadedNoti = notiSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(loadedNoti);
    }
    loadData();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    
    if (isSignup) {
      const existingUser = users.find(u => u.username === authForm.username);
      if (existingUser) {
        alert('Username already exists');
        return;
      }

      if (authForm.role === 'Professor' && !authForm.selectedSubject) {
        alert('Please select a subject');
        return;
      }

      if (authForm.role === 'Club Head' && !authForm.selectedClub) {
        alert('Please select a club');
        return;
      }

      if (authForm.role === 'Student' && (authForm.subjects.length === 0 || authForm.clubs.length === 0)) {
        alert('Please select at least one subject and one club');
        return;
      }

      const user = {
        id: Date.now().toString(),
        username: authForm.username,
        password: authForm.password,
        role: authForm.role,
        subjects: authForm.role === 'Student' ? authForm.subjects : 
                  authForm.role === 'Professor' ? [authForm.selectedSubject] : [],
        clubs: authForm.role === 'Student' ? authForm.clubs :
               authForm.role === 'Club Head' ? [authForm.selectedClub] : [],
        createdAt: new Date().toISOString()
      };

      // persist to Firestore (necessary change)
      await setDoc(doc(db, "users", user.id), user);
      setUsers([...users, user]);

      setCurrentUser(user);
      setShowAuthModal(false);
      resetAuthForm();
    } else {
      const user = users.find(u => 
        u.username === authForm.username && u.password === authForm.password
      );

      if (user) {
        setCurrentUser(user);
        setShowAuthModal(false);
        resetAuthForm();
      } else {
        alert('Invalid credentials');
      }
    }
  };

  const resetAuthForm = () => {
    setAuthForm({
      username: '',
      password: '',
      role: 'Student',
      subjects: [],
      clubs: [],
      selectedSubject: '',
      selectedClub: ''
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setShowAuthModal(true);
    setActiveTab('dashboard');
  };

  // When creating non-personal events, notify affected users - minimal necessary change
  const handleCreateEvent = async (e) => {
    e.preventDefault();

    if (newEvent.type !== 'personal' && !newEvent.category) {
      alert('Please select a category');
      return;
    }

    const event = {
      id: Date.now().toString(),
      ...newEvent,
      creatorId: currentUser?.id || 'unknown',
      creatorName: currentUser?.username || 'unknown',
      createdAt: new Date().toISOString(),
      cancelled: false
    };

    // persist event to Firestore (necessary)
    await setDoc(doc(db, "events", event.id), event);
    setEvents([...events, event]);

    // if academic/club event, create notifications for affected users
    if (event.type !== 'personal') {
      const affectedUsers = users.filter(u => {
        if (event.type === 'academic') {
          return (u.subjects || []).includes(event.category);
        }
        if (event.type === 'club') {
          return (u.clubs || []).includes(event.category);
        }
        return false;
      });

      const notis = affectedUsers.map(user => ({
        id: Date.now().toString() + Math.random(),
        userId: user.id,
        message: `New ${event.type} event "${event.title}" for ${event.category}`,
        eventId: event.id,
        createdAt: new Date().toISOString(),
        read: false
      }));

      // persist notifications to Firestore (necessary)
      await Promise.all(notis.map(n => addDoc(collection(db, "notifications"), n)));
      setNotifications([...notifications, ...notis]);
    }

    setShowEventModal(false);
    setNewEvent({
      title: '',
      description: '',
      date: '',
      time: '',
      type: 'personal',
      category: ''
    });
  };

  const getVisibleEvents = () => {
    if (!currentUser) return [];

    const userHiddenIds = hiddenEvents
      .filter(h => h.userId === currentUser.id)
      .map(h => h.eventId);

    return events.filter(event => {
      if (userHiddenIds.includes(event.id)) return false;
      if (event.cancelled) return false;

      if (event.type === 'personal') {
        return event.creatorId === currentUser.id;
      }

      if (event.type === 'academic') {
        return (currentUser.subjects || []).includes(event.category);
      }

      if (event.type === 'club') {
        return (currentUser.clubs || []).includes(event.category);
      }

      return false;
    });
  };

  const getFilteredEvents = () => {
    const visible = getVisibleEvents();
    const now = new Date();

    if (eventFilter === 'all') return visible;
    if (eventFilter === 'upcoming') {
      return visible.filter(e => new Date(e.date + 'T' + e.time) >= now);
    }
    if (eventFilter === 'past') {
      return visible.filter(e => new Date(e.date + 'T' + e.time) < now);
    }
    if (eventFilter === 'personal') {
      return visible.filter(e => e.type === 'personal');
    }
    if (eventFilter === 'academic') {
      return visible.filter(e => e.type === 'academic');
    }
    if (eventFilter === 'club') {
      return visible.filter(e => e.type === 'club');
    }

    return visible;
  };

  // hideEvent now persists to Firestore (necessary)
  const hideEvent = async (eventId) => {
    if (!currentUser) return;
    const payload = {
      userId: currentUser.id,
      eventId,
      hiddenAt: new Date().toISOString()
    };
    await addDoc(collection(db, "hiddenEvents"), payload);
    setHiddenEvents([...hiddenEvents, payload]);
  };

  // unhideEvent removes from Firestore (necessary)
  const unhideEvent = async (eventId) => {
    if (!currentUser) return;
    // find docs matching userId & eventId
    const q = query(collection(db, "hiddenEvents"), where("userId", "==", currentUser.id), where("eventId", "==", eventId));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "hiddenEvents", d.id))));
    setHiddenEvents(hiddenEvents.filter(h => !(h.userId === currentUser.id && h.eventId === eventId)));
  };

  const deleteEvent = (eventId) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    if (event.creatorId !== currentUser.id || event.type !== 'personal') {
      alert('You can only delete your own personal events');
      return;
    }

    if (window.confirm('Delete this event permanently?')) {
      // local removal; persist deletion could be added if desired (minimal change: keep local)
      setEvents(events.filter(e => e.id !== eventId));
    }
  };

  // cancelEvent marks cancelled and notifies affected users (persist notifications locally and to Firestore)
  const cancelEvent = async (eventId) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    
    if (event.creatorId !== currentUser.id) {
      alert('You can only cancel your own events');
      return;
    }

    if (event.type === 'personal') {
      alert('Use delete for personal events');
      return;
    }

    if (window.confirm('Cancel this event for all users?')) {
      // update local state
      setEvents(events.map(e => e.id === eventId ? { ...e, cancelled: true } : e));

      // persist cancelled flag to Firestore (necessary)
      try {
        await updateDoc(doc(db, "events", eventId), { cancelled: true });
      } catch (err) {
        console.error('Failed to update event cancelled flag:', err);
      }

      const affectedUsers = users.filter(u => {
        if (event.type === 'academic') {
          return (u.subjects || []).includes(event.category);
        }
        if (event.type === 'club') {
          return (u.clubs || []).includes(event.category);
        }
        return false;
      });

      const newNotifications = affectedUsers.map(user => ({
        id: Date.now().toString() + Math.random(),
        userId: user.id,
        message: `Event "${event.title}" has been cancelled`,
        eventId: eventId,
        createdAt: new Date().toISOString(),
        read: false
      }));

      // persist notifications to Firestore
      await Promise.all(newNotificationsToAdd(newNotifications));
      setNotifications([...notifications, ...newNotifications]);
    }
  };

  // helper to add notifications docs
  const newNotificationsToAdd = (arr) => arr.map(n => addDoc(collection(db, "notifications"), n));

  const clearPastEvents = () => {
    if (window.confirm('Delete all your past personal events? This cannot be undone.')) {
      const now = new Date();
      setEvents(events.filter(e => {
        if (e.type === 'personal' && e.creatorId === currentUser.id) {
          const eventDate = new Date(e.date + 'T' + e.time);
          return eventDate >= now;
        }
        return true;
      }));
    }
  };

  const getUserHiddenEvents = () => {
    const userHiddenIds = hiddenEvents
      .filter(h => h.userId === currentUser?.id)
      .map(h => h.eventId);

    return events.filter(e => userHiddenIds.includes(e.id) && !e.cancelled);
  };

  const getUserNotifications = () => {
    return notifications.filter(n => n.userId === currentUser?.id);
  };

  // mark notification as read persists to Firestore (necessary)
  const markNotificationAsRead = async (notificationId) => {
    setNotifications(notifications.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    ));
    // persist if notification doc exists (best-effort - search by id field stored inside doc)
    try {
      // notifications were added with addDoc (which gives a Firestore doc id different from n.id field),
      // so we try to find matching doc where notification.id == n.id field. This is a minimal approach.
      const q = query(collection(db, "notifications"), where("id", "==", notificationId));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map(d => updateDoc(doc(db, "notifications", d.id), { read: true })));
    } catch (err) {
      // ignore persistence errors for now (minimal change)
      // console.error('Failed to persist notification read state', err);
    }
  };

  const getUpcomingEvents = () => {
    const visible = getVisibleEvents();
    const now = new Date();
    return visible
      .filter(e => new Date(e.date + 'T' + e.time) >= now)
      .sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time))
      .slice(0, 5);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getEventTypeColor = (type) => {
    if (type === 'personal') return 'bg-blue-100 text-blue-800';
    if (type === 'academic') return 'bg-green-100 text-green-800';
    if (type === 'club') return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (showAuthModal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <Calendar className="w-10 h-10 text-indigo-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-800">Event Tracker</h1>
          </div>

          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setIsSignup(false)}
              className={`flex-1 py-2 rounded-md transition-colors ${
                !isSignup ? 'bg-white shadow text-indigo-600' : 'text-gray-600'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsSignup(true)}
              className={`flex-1 py-2 rounded-md transition-colors ${
                isSignup ? 'bg-white shadow text-indigo-600' : 'text-gray-600'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            {isSignup && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={authForm.role}
                    onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="Student">Student</option>
                    <option value="Professor">Professor</option>
                    <option value="Club Head">Club Head</option>
                  </select>
                </div>

                {authForm.role === 'Professor' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                    <select
                      value={authForm.selectedSubject}
                      onChange={(e) => setAuthForm({ ...authForm, selectedSubject: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Subject</option>
                      {SUBJECTS.map(subject => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))}
                    </select>
                  </div>
                )}

                {authForm.role === 'Club Head' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Club</label>
                    <select
                      value={authForm.selectedClub}
                      onChange={(e) => setAuthForm({ ...authForm, selectedClub: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Club</option>
                      {CLUBS.map(club => (
                        <option key={club} value={club}>{club}</option>
                      ))}
                    </select>
                  </div>
                )}

                {authForm.role === 'Student' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subjects</label>
                      <div className="border border-gray-300 rounded-md p-2 max-h-32 overflow-y-auto">
                        {SUBJECTS.map(subject => (
                          <label key={subject} className="flex items-center p-1 hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={authForm.subjects.includes(subject)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAuthForm({ ...authForm, subjects: [...authForm.subjects, subject] });
                                } else {
                                  setAuthForm({ ...authForm, subjects: authForm.subjects.filter(s => s !== subject) });
                                }
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm">{subject}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Clubs</label>
                      <div className="border border-gray-300 rounded-md p-2 max-h-32 overflow-y-auto">
                        {CLUBS.map(club => (
                          <label key={club} className="flex items-center p-1 hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={authForm.clubs.includes(club)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAuthForm({ ...authForm, clubs: [...authForm.clubs, club] });
                                } else {
                                  setAuthForm({ ...authForm, clubs: authForm.clubs.filter(c => c !== club) });
                                }
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm">{club}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 transition-colors font-medium"
            >
              {isSignup ? 'Sign Up' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-indigo-600 mr-2" />
              <h1 className="text-xl font-bold text-gray-800">Event Tracker</h1>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {currentUser?.username} ({currentUser?.role})
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex space-x-1 mb-6 bg-white rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-2 px-4 rounded-md transition-colors ${
              activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`flex-1 py-2 px-4 rounded-md transition-colors ${
              activeTab === 'events' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Events
          </button>
          <button
            onClick={() => setActiveTab('hidden')}
            className={`flex-1 py-2 px-4 rounded-md transition-colors ${
              activeTab === 'hidden' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Hidden Events
          </button>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
              <button
                onClick={() => setShowEventModal(true)}
                className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Event
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Events</h3>
                <p className="text-3xl font-bold text-indigo-600">{getVisibleEvents().length}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Upcoming</h3>
                <p className="text-3xl font-bold text-green-600">
                  {getVisibleEvents().filter(e => new Date(e.date + 'T' + e.time) >= new Date()).length}
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Past Events</h3>
                <p className="text-3xl font-bold text-gray-600">
                  {getVisibleEvents().filter(e => new Date(e.date + 'T' + e.time) < new Date()).length}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Filter Events</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {['all', 'upcoming', 'past', 'personal', 'academic', 'club'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => setEventFilter(filter)}
                    className={`px-4 py-2 rounded-md transition-colors capitalize ${
                      eventFilter === filter
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Upcoming Events</h3>
              <div className="space-y-3">
                {getUpcomingEvents().length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No upcoming events</p>
                ) : (
                  getUpcomingEvents().map(event => (
                    <div key={event.id} className="flex items-start justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getEventTypeColor(event.type)}`}>
                            {event.type}
                          </span>
                          {event.category && (
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                              {event.category}
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-gray-800">{event.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <span>{formatDate(event.date)}</span>
                          <span>{formatTime(event.time)}</span>
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        {event.type !== 'personal' && (
                          <button
                            onClick={() => hideEvent(event.id)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                            title="Hide event"
                          >
                            <EyeOff className="w-4 h-4" />
                          </button>
                        )}
                        {event.type === 'personal' && event.creatorId === currentUser?.id && (
                          <button
                            onClick={() => deleteEvent(event.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete event"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {event.type !== 'personal' && event.creatorId === currentUser?.id && (
                          <button
                            onClick={() => cancelEvent(event.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Cancel event"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">All Events</h2>
              <div className="flex space-x-3">
                <button
                  onClick={clearPastEvents}
                  className="flex items-center bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-5 h-5 mr-2" />
                  Clear Past Events
                </button>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative flex items-center bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
                >
                  <Bell className="w-5 h-5 mr-2" />
                  Notifications
                  {getUserNotifications().filter(n => !n.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {getUserNotifications().filter(n => !n.read).length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowEventModal(true)}
                  className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  New Event
                </button>
              </div>
            </div>

            {showNotifications && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Notifications</h3>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-2">
                  {getUserNotifications().length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No notifications</p>
                  ) : (
                    getUserNotifications().map(notification => (
                      <div
                        key={notification.id}
                        onClick={() => markNotificationAsRead(notification.id)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          notification.read ? 'bg-gray-50' : 'bg-blue-50 border-l-4 border-blue-500'
                        }`}
                      >
                        <div className="flex items-start">
                          <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm text-gray-800">{notification.message}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(notification.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Filter Events</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {['all', 'upcoming', 'past', 'personal', 'academic', 'club'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => setEventFilter(filter)}
                    className={`px-4 py-2 rounded-md transition-colors capitalize ${
                      eventFilter === filter
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="space-y-3">
                {getFilteredEvents().length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No events found</p>
                ) : (
                  getFilteredEvents()
                    .sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time))
                    .map(event => (
                      <div key={event.id} className="flex items-start justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${getEventTypeColor(event.type)}`}>
                              {event.type}
                            </span>
                            {event.category && (
                              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                                {event.category}
                              </span>
                            )}
                          </div>
                          <h4 className="font-semibold text-gray-800">{event.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <span>{formatDate(event.date)}</span>
                            <span>{formatTime(event.time)}</span>
                          </div>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          {event.type !== 'personal' && (
                            <button
                              onClick={() => hideEvent(event.id)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                              title="Hide event"
                            >
                              <EyeOff className="w-4 h-4" />
                            </button>
                          )}
                          {event.type === 'personal' && event.creatorId === currentUser?.id && (
                            <button
                              onClick={() => deleteEvent(event.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Delete event"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {event.type !== 'personal' && event.creatorId === currentUser?.id && (
                            <button
                              onClick={() => cancelEvent(event.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Cancel event"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hidden' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">Hidden Events</h2>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="space-y-3">
                {getUserHiddenEvents().length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No hidden events</p>
                ) : (
                  getUserHiddenEvents().map(event => (
                    <div key={event.id} className="flex items-start justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getEventTypeColor(event.type)}`}>
                            {event.type}
                          </span>
                          {event.category && (
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                              {event.category}
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-gray-800">{event.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <span>{formatDate(event.date)}</span>
                          <span>{formatTime(event.time)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => unhideEvent(event.id)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors ml-4"
                        title="Unhide event"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {showEventModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">Create New Event</h3>
                <button
                  onClick={() => setShowEventModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                  <select
                    value={newEvent.type}
                    onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value, category: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="personal">Personal</option>
                    {currentUser?.role === 'Professor' && <option value="academic">Academic</option>}
                    {currentUser?.role === 'Club Head' && <option value="club">Club</option>}
                  </select>
                </div>

                {newEvent.type === 'academic' && currentUser?.role === 'Professor' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                    <select
                      value={newEvent.category}
                      onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Subject</option>
                      {currentUser.subjects?.map(subject => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))}
                    </select>
                  </div>
                )}

                {newEvent.type === 'club' && currentUser?.role === 'Club Head' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Club</label>
                    <select
                      value={newEvent.category}
                      onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Club</option>
                      {currentUser.clubs?.map(club => (
                        <option key={club} value={club}>{club}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Title</label>
                  <input
                    type="text"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    rows="3"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                    <input
                      type="time"
                      value={newEvent.time}
                      onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEventModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    Create Event
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventTracker;
