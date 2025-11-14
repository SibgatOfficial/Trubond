// Hide loading overlay when page is ready
window.addEventListener("load", function () {
  setTimeout(function () {
    document.getElementById("loading-overlay").style.display = "none";
  }, 2000); // Show for 2 seconds
});
// Your Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyD0_KG4ltnJtazByZOFFoUNuV470JnLD38",
  authDomain: "trubond-app.firebaseapp.com",
  projectId: "trubond-app",
  storageBucket: "trubond-app.firebasestorage.app",
  messagingSenderId: "698788489428",
  appId: "1:698788489428:web:8cf9c660dd8cb6ce87f341",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
// Helper function to format Firestore Timestamps
function formatFirestoreTimestamp(timestamp) {
  if (!timestamp) return "Date not set";

  // If it's a Firestore Timestamp object
  if (timestamp.toDate) {
    return timestamp.toDate().toLocaleString();
  }
  // If it's already a Date object or ISO string
  return new Date(timestamp).toLocaleString();
}
let currentUserData = null;
let currentPostIdForComments = null;
let viewedPostIds = new Set();
let isUploadingViews = false;
let chatListener = null;
let currentChatType = null;
let currentChatRoomId = null;

// --- GLOBAL ELEMENTS WITH NULL CHECKS ---
const mainContainer = document.getElementById("main-container");
const statsSidebar = document.getElementById("stats-sidebar");
const createPostBtn = document.getElementById("create-post-btn");
const submitPostBtn = document.getElementById("submit-post-btn");
const postModal = document.getElementById("create-post-modal");

// --- AUTH GUARD ---
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log("User is here:", user.uid);
    loadUserData(user.uid);
  } else {
    console.log("No user, redirecting to index.html");
    window.location.href = "index.html";
  }
});

// --- DATA LOADING WITH ERROR HANDLING ---
async function loadUserData(userId) {
  const userRef = db.collection("users").doc(userId);
  try {
    const doc = await userRef.get();
    if (doc.exists) {
      currentUserData = { id: doc.id, ...doc.data() };

      const userNameEl = document.getElementById("user-name-desktop");
      if (userNameEl) {
        userNameEl.innerHTML = `
                <img src="${
                  currentUserData.profilePhotoUrl ||
                  "https://placehold.co/32x32/f3f4f6/6b7280?text=?"
                }" alt="${currentUserData.name}">
                <span>${currentUserData.name}</span>
              `;
      }

      const statPostsEl = document.getElementById("stat-posts");
      const statProjectsEl = document.getElementById("stat-projects");
      const statEventsEl = document.getElementById("stat-events");

      if (statPostsEl) statPostsEl.innerText = currentUserData.postCount || 0;
      if (statProjectsEl)
        statProjectsEl.innerText = currentUserData.projectsJoined || 0;
      if (statEventsEl)
        statEventsEl.innerText = currentUserData.eventsJoined || 0;

      showPage("home");
    } else {
      console.error("User doc not found! Redirecting to create page.");
      window.location.href = "create.html";
    }
  } catch (error) {
    console.error("Error loading user data:", error);
    alert("Failed to load user data. Please refresh the page.");
  }
}

async function loadHomeFeed() {
  const feedContent = document.getElementById("home-feed-content");
  if (!feedContent) return;

  setContentState(feedContent, "Loading posts...");

  try {
    const snapshot = await db
      .collection("posts")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    if (snapshot.empty) {
      setContentState(feedContent, "No posts yet. Be the first!");
      return;
    }

    // Get all liked posts for the current user in one go
    const postIds = snapshot.docs.map((doc) => doc.id);
    const likedDocs = await Promise.all(
      postIds.map((id) =>
        db.doc(`posts/${id}/likes/${currentUserData.id}`).get()
      )
    );

    const userLikes = new Set();
    likedDocs.forEach((doc, index) => {
      if (doc.exists) {
        userLikes.add(postIds[index]);
      }
    });

    let html = "";
    snapshot.forEach((doc) => {
      const post = doc.data();
      const postId = doc.id;
      const isLiked = userLikes.has(postId);

      viewedPostIds.add(postId);

      html += renderPostCard(post, postId, isLiked);
    });
    feedContent.innerHTML = html;
  } catch (err) {
    console.error("Error loading posts:", err);
    setContentState(feedContent, "Error loading posts. Please refresh.");
  }
}

function renderPostCard(post, postId, isLiked) {
  const editButton =
    post.authorId === currentUserData.id
      ? `
          <div class="post-actions">
            <button class="action-btn" title="Edit Post" onclick="openEditPostModal('${postId}', \`${escapeHtml(
          post.text
        ).replace(/`/g, "\\`")}\`)">
              <span class="material-symbols-outlined">edit</span>
            </button>
          </div>
        `
      : "";

  return `
      <div class="card" data-post-id="${postId}">
        <div class="card-header">
          <img src="${
            post.authorPhoto ||
            "https://placehold.co/40x40/f3f4f6/6b7280?text=?"
          }" 
               alt="${escapeHtml(post.authorUsername)}" 
               style="cursor: pointer;" onclick="showUserProfile('${
                 post.authorId
               }')">
          <div class="author-info">
            <strong style="cursor: pointer;" onclick="showUserProfile('${
              post.authorId
            }')">
              ${escapeHtml(post.authorUsername)}
            </strong>
            <span>${new Date(post.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <div class="card-body">
          <p>${escapeHtml(post.text)}</p>
          ${
            post.imageUrl
              ? `<img src="${post.imageUrl}" class="post-image" style="height:auto;">`
              : ""
          }
          ${editButton}
        </div>
        <div class="card-footer">
          <div class="footer-action ${
            isLiked ? "liked" : ""
          }" onclick="handleLikeClick('${postId}')">
            <span class="material-symbols-outlined">thumb_up</span> 
            <span id="like-count-${postId}">${post.likeCount || 0}</span> Likes
          </div>
          <div class="footer-action" onclick="openCommentsModal('${postId}')">
            <span class="material-symbols-outlined">chat_bubble</span>
            <span>${post.commentCount || 0}</span> Comments
          </div>
          <div class="footer-action">
            <span class="material-symbols-outlined">visibility</span>
            <span>${post.viewCount || 0}</span> Views
          </div>
        </div>
      </div>
    `;
}

async function loadProjects() {
  const projectsContent = document.getElementById("projects-feed-content");
  if (!projectsContent) return;

  setContentState(projectsContent, "Loading projects...");

  try {
    const snapshot = await db
      .collection("projects")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    if (snapshot.empty) {
      setContentState(projectsContent, "No projects posted yet.");
      return;
    }

    // Get user's pending requests - alternative approach without collectionGroup
    const userPendingRequests = new Set();

    // Fetch requests for each project individually
    const requestPromises = snapshot.docs.map(async (doc) => {
      try {
        const requestDoc = await db
          .doc(`projects/${doc.id}/requests/${currentUserData.id}`)
          .get();
        if (requestDoc.exists && requestDoc.data().status === "pending") {
          userPendingRequests.add(doc.id);
        }
      } catch (error) {
        console.log(
          `No access to requests for project ${doc.id} or no pending request`
        );
      }
    });

    await Promise.all(requestPromises);

    let html = "";
    snapshot.forEach((doc) => {
      const project = { id: doc.id, ...doc.data() };
      html += renderProjectCard(project, userPendingRequests);
    });
    projectsContent.innerHTML = html;
  } catch (err) {
    console.error("Error loading projects:", err);
    setContentState(projectsContent, "Error loading projects.");
  }
}
function renderProjectCard(project, userPendingRequests) {
  const skillsHtml = (project.skillsRequired || [])
    .map((skill) => `<span class="skill-tag">${skill}</span>`)
    .join("");

  let buttonHtml = "";
  const isOwner = project.ownerId === currentUserData.id;
  const isMember =
    project.members && project.members.includes(currentUserData.id);
  const hasPendingRequest = userPendingRequests.has(project.id);

  if (isOwner) {
    buttonHtml = `
    <div style="display: flex; gap: 8px;">
      <button class="card-button secondary" onclick="manageProjectRequests('${project.id}')" style="flex: 1;">
        <span class="material-symbols-outlined">settings</span> Manage Requests
      </button>
      <button class="card-button danger" onclick="handleDeleteProject('${project.id}')" style="flex: 1;">
        <span class="material-symbols-outlined">delete</span> Delete
      </button>
    </div>
  `;
  } else if (isMember) {
    buttonHtml = `
      <button class="card-button success" disabled>
        <span class="material-symbols-outlined">check_circle</span> Member
      </button>
    `;
  } else if (hasPendingRequest) {
    buttonHtml = `
      <button class="card-button secondary" disabled>
        <span class="material-symbols-outlined">hourglass_top</span> Request Sent
      </button>
    `;
  } else {
    buttonHtml = `
      <button class="card-button" onclick="handleProjectRequest('${project.id}')">
        <span class="material-symbols-outlined">person_add</span> Request to Join
      </button>
    `;
  }

  // Show Members button - always visible
  const showMembersBtn = `
    <button class="card-button secondary" onclick="showProjectMembers('${
      project.id
    }')" style="margin-top: 8px;">
      <span class="material-symbols-outlined">group</span> Show Members (${
        project.members?.length || 1
      })
    </button>
  `;

  return `
    <div class="card">
      <h3>${project.title}</h3>
   <p class="card-meta">By <span style="cursor: pointer; color: var(--primary-blue); font-weight: 500;" onclick="showUserProfile('${
     project.ownerId
   }')">@${project.ownerUsername}</span> | Members: ${
    project.members?.length || 1
  }/${project.membersNeeded}</p>
     <p>${escapeHtml(project.description)}</p>
      <div class="skills-list">${skillsHtml}</div>
      ${buttonHtml}
      ${showMembersBtn}
    </div>`;
}
async function handleDeleteProject(projectId) {
  if (!currentUserData) return;

  if (
    !confirm(
      "Are you sure you want to delete this project? This action cannot be undone!"
    )
  ) {
    return;
  }

  try {
    // First get the project to verify ownership
    const projectDoc = await db.collection("projects").doc(projectId).get();
    if (!projectDoc.exists) {
      alert("Project not found!");
      return;
    }

    const project = projectDoc.data();

    // Double check ownership (security)
    if (project.ownerId !== currentUserData.id) {
      alert("You can only delete your own projects!");
      return;
    }

    // Delete the project
    await db.collection("projects").doc(projectId).delete();

    alert("Project deleted successfully!");
    loadProjects(); // Refresh the projects list
  } catch (error) {
    console.error("Error deleting project:", error);
    alert("Failed to delete project. Please try again.");
  }
}
async function loadEvents() {
  const eventsContent = document.getElementById("events-feed-content");
  if (!eventsContent) return;

  setContentState(eventsContent, "Loading events...");

  try {
    const snapshot = await db
      .collection("events")
      .orderBy("date", "asc")
      .limit(20)
      .get();

    if (snapshot.empty) {
      setContentState(eventsContent, "No events scheduled.");
      return;
    }

    // Get user's event attendance
    const eventIds = snapshot.docs.map((doc) => doc.id);
    const userAttendancePromises = eventIds.map((id) =>
      db.doc(`events/${id}/attendees/${currentUserData.id}`).get()
    );

    const userAttendance = await Promise.all(userAttendancePromises);

    const userAttendedEvents = new Set();
    userAttendance.forEach((doc, index) => {
      if (doc.exists) {
        userAttendedEvents.add(eventIds[index]);
      }
    });

    let html = "";
    snapshot.forEach((doc) => {
      const event = { id: doc.id, ...doc.data() };
      const hasJoined = userAttendedEvents.has(event.id);
      html += renderEventCard(event, hasJoined);
    });
    eventsContent.innerHTML = html;
  } catch (err) {
    console.error("Error loading events:", err);
    setContentState(eventsContent, "Error loading events.");
  }
}

function renderEventCard(event, hasJoined) {
  const isFull = event.attendeeCount >= event.maxAttendees && !hasJoined;

  let buttonHtml = "";
  if (hasJoined) {
    buttonHtml = `
      <div style="display: flex; gap: 8px;">
        <button class="card-button danger" onclick="handleLeaveEvent('${event.id}')" style="flex: 1;">
          <span class="material-symbols-outlined">logout</span> Leave Event
        </button>
        <button class="card-button success" onclick="showEventQR('${event.id}')" style="flex: 1;">
          <span class="material-symbols-outlined">qr_code</span> Show Ticket
        </button>
      </div>
    `;
  } else if (isFull) {
    buttonHtml = `
      <button class="card-button secondary" disabled>
        <span class="material-symbols-outlined">no_accounts</span> Event Full
      </button>
    `;
  } else {
    buttonHtml = `
      <button class="card-button success" onclick="handleJoinEvent('${event.id}')">
        <span class="material-symbols-outlined">login</span> Join Event
      </button>
    `;
  }

  return `
    <div class="card">
      <h3>${event.title}</h3>
      <p class="card-meta">
        <span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;">event</span>
        ${formatFirestoreTimestamp(event.date)}
      </p>
      <p class="card-meta">
        <span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;">location_on</span>
        ${event.location}
      </p>
      <p class="card-meta">
        <span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;">people</span>
        ${event.attendeeCount || 0}/${event.maxAttendees || "N/A"} attendees
      </p>
   <p>${escapeHtml(event.description)}</p>
      ${
        event.coverPhotoUrl
          ? `<img src="${event.coverPhotoUrl}" style="height:auto; object-fit:cover; border-radius:10px; margin:10px 0;"/>`
          : ""
      }
      ${buttonHtml}
    </div>`;
}
document.addEventListener("click", function (e) {
  const qrBtn = e.target.closest(".show-qr-btn");
  if (qrBtn) {
    const eventId = qrBtn.getAttribute("data-event-id");
    const eventTitle = qrBtn.getAttribute("data-event-title");
    showEventQR(eventId, eventTitle);
  }
});
function loadGroups() {
  if (!currentUserData) return;
  const groupsContent = document.getElementById("groups-list-content");
  if (!groupsContent) return;

  const userBranch = currentUserData.branch;
  const allBranches = ["CSE", "CSD", "ECE", "MECH", "CIVIL", "EEE"];

  let html = "<h2>Your Branch Group</h2>";
  let otherGroupsHtml = "<h2>Other Groups</h2>";

  allBranches.forEach((branch) => {
    const isUserBranch = branch.toLowerCase() === userBranch?.toLowerCase();
    const cardHtml = `
        <div class="card">
          <h3>${branch} Group</h3>
          <p>Discussions for all ${branch} students.</p>
          <button class="card-button" ${
            isUserBranch ? "" : "disabled"
          } onclick="${
      isUserBranch
        ? `showPage('chat'); openChatRoom('branch', '${branch.toLowerCase()}', '${branch} Group')`
        : ""
    }">
            <span class="material-symbols-outlined">${
              isUserBranch ? "forum" : "lock"
            }</span>
            ${isUserBranch ? "Join Chat" : "Not Your Branch"}
          </button>
        </div>
      `;
    if (isUserBranch) {
      html += cardHtml;
    } else {
      otherGroupsHtml += cardHtml;
    }
  });
  groupsContent.innerHTML = html + otherGroupsHtml;
}

function loadProfile() {
  if (!currentUserData) return;
  const profileContent = document.getElementById("profile-card");
  if (!profileContent) return;

  profileContent.innerHTML = `
    <div class="card-header">
      <img src="${
        currentUserData.profilePhotoUrl ||
        "https://placehold.co/40x40/f3f4f6/6b7280?text=?"
      }" alt="${currentUserData.name}" style="width:200px;height:200px;">

      <div class="author-info">
        <strong>${currentUserData.name}</strong>
        <span>@${currentUserData.username}</span>
      </div>
    </div>
    <div class="card-body">
      <p><strong>Bio:</strong> ${currentUserData.bio || "No bio yet."}</p>
      <p><strong>Email:</strong> ${currentUserData.email || "No email."}</p>
      <p><strong>Branch:</strong> ${currentUserData.branch || "No branch."}</p>
      <p><strong>Phone:</strong> ${
        currentUserData.phone || "No phone number."
      }</p>
    </div>
  `;

  // Load the additional sections
  loadProfileEvents();
  loadProfileProjects();
  loadProfilePosts();
}
// --- CHAT FUNCTIONALITY ---
async function loadChatRooms() {
  const chatRoomList = document.getElementById("chat-room-list");
  if (!chatRoomList) return;

  setContentState(chatRoomList, "Loading chat rooms...");

  try {
    let html = "";

    // Global Chat
    html += `<div class="chat-section-header">Global Chat</div>`;
    html += `
            <div class="chat-room-item" onclick="openChatRoom('global', 'live_chat', 'Global Live Chat')">
              <span class="material-symbols-outlined">public</span>
              <span>Global Live Chat</span>
            </div>
          `;

    // Branch Group
    html += `<div class="chat-section-header">Branch Group</div>`;
    if (currentUserData.branch) {
      html += `
              <div class="chat-room-item" onclick="openChatRoom('branch', '${currentUserData.branch.toLowerCase()}', '${
        currentUserData.branch
      } Group')">
                <span class="material-symbols-outlined">groups</span>
                <span>${currentUserData.branch} Group</span>
              </div>
            `;
    } else {
      html += `<p>Set branch in profile to access branch chat</p>`;
    }

    // Project Groups
    html += `<div class="chat-section-header">Project Groups</div>`;
    const projectsSnapshot = await db
      .collection("projects")
      .where("members", "array-contains", currentUserData.id)
      .get();

    if (projectsSnapshot.empty) {
      html += `<p>No project chats available. Join a project first.</p>`;
    } else {
      projectsSnapshot.forEach((doc) => {
        const project = doc.data();
        html += `
                <div class="chat-room-item" onclick="openChatRoom('project', '${doc.id}', '${project.title}')">
                  <span class="material-symbols-outlined">folder</span>
                  <span>${project.title}</span>
                </div>
              `;
      });
    }

    chatRoomList.innerHTML = html;
  } catch (error) {
    console.error("Error loading chat rooms:", error);
    setContentState(chatRoomList, "Error loading chat rooms.");
  }
}

function openChatRoom(type, id, name) {
  // Cancel previous listener
  if (chatListener) {
    chatListener();
    chatListener = null;
  }

  currentChatType = type;
  currentChatRoomId = id;

  // Update UI
  const chatRoomName = document.getElementById("chat-room-name");
  const chatFormContainer = document.getElementById("chat-form-container");
  const chatRoomItems = document.querySelectorAll(".chat-room-item");

  if (chatRoomName) chatRoomName.textContent = name;
  if (chatFormContainer) chatFormContainer.style.display = "flex";

  // Highlight active room
  chatRoomItems.forEach((item) => item.classList.remove("active"));
  event.currentTarget.classList.add("active");

  // Load messages
  loadChatMessages(type, id);
}

function loadChatMessages(type, roomId) {
  const messageList = document.getElementById("chat-message-list");
  if (!messageList) return;

  setContentState(messageList, "Loading messages...");

  let collectionPath;
  switch (type) {
    case "global":
      collectionPath = `global_chat/${roomId}/messages`;
      break;
    case "branch":
      collectionPath = `branch_chats/${roomId}/messages`;
      break;
    case "project":
      collectionPath = `project_chats/${roomId}/messages`;
      break;
    default:
      console.error("Unknown chat type:", type);
      return;
  }

  try {
    chatListener = db
      .collection(collectionPath)
      .orderBy("createdAt", "asc")
      .onSnapshot(
        (snapshot) => {
          if (snapshot.empty) {
            messageList.innerHTML =
              "<p>No messages yet. Start the conversation!</p>";
            return;
          }

          let html = "";
          snapshot.forEach((doc) => {
            const message = doc.data();
            const isOwnMessage = message.senderId === currentUserData.id;
            html += `
                  <div class="message ${
                    isOwnMessage ? "own-message" : "other-message"
                  }">
                    ${
                      !isOwnMessage
                        ? `<div class="message-sender">${message.senderUsername}</div>`
                        : ""
                    }
                    <div class="message-text">${message.text}</div>
                    <div class="message-time">${new Date(
                      message.createdAt
                    ).toLocaleTimeString()}</div>
                  </div>
                `;
          });
          messageList.innerHTML = html;
          messageList.scrollTop = messageList.scrollHeight;
        },
        (error) => {
          console.error("Error loading messages:", error);
          setContentState(messageList, "Error loading messages.");
        }
      );
  } catch (error) {
    console.error("Error setting up chat listener:", error);
    setContentState(messageList, "Error loading messages.");
  }
}

async function sendChatMessage() {
  const messageInput = document.getElementById("chat-message-input");
  if (!messageInput || !currentChatType || !currentChatRoomId) return;

  const text = messageInput.value.trim();
  if (!text) return;

  const sendBtn = document.getElementById("send-chat-message-btn");
  if (sendBtn) sendBtn.disabled = true;

  try {
    let collectionPath;
    switch (currentChatType) {
      case "global":
        collectionPath = `global_chat/${currentChatRoomId}/messages`;
        break;
      case "branch":
        collectionPath = `branch_chats/${currentChatRoomId}/messages`;
        break;
      case "project":
        collectionPath = `project_chats/${currentChatRoomId}/messages`;
        break;
    }

    await db.collection(collectionPath).add({
      text: escapeHtml(text),
      senderId: currentUserData.id,
      senderUsername: currentUserData.username,
      createdAt: new Date().toISOString(),
    });

    messageInput.value = "";
  } catch (error) {
    console.error("Error sending message:", error);
    alert("Failed to send message. Please try again.");
  }

  if (sendBtn) sendBtn.disabled = false;
}

// --- PROJECT MANAGEMENT ---
async function handleProjectRequest(projectId) {
  if (!currentUserData) return;

  try {
    await db
      .collection(`projects/${projectId}/requests`)
      .doc(currentUserData.id)
      .set({
        userId: currentUserData.id,
        username: currentUserData.username,
        status: "pending",
        requestedAt: new Date().toISOString(),
      });

    alert("Request sent successfully!");
    loadProjects();
  } catch (error) {
    console.error("Error sending project request:", error);
    alert("Failed to send request. Please try again.");
  }
}

async function manageProjectRequests(projectId) {
  const modal = document.getElementById("project-requests-modal");
  const requestsList = document.getElementById("project-requests-list");

  if (!modal || !requestsList) return;

  setContentState(requestsList, "Loading requests...");
  modal.style.display = "block";

  try {
    const snapshot = await db
      .collection(`projects/${projectId}/requests`)
      .where("status", "==", "pending")
      .get();

    if (snapshot.empty) {
      setContentState(requestsList, "No pending requests.");
      return;
    }

    let html = "";
    snapshot.forEach((doc) => {
      const request = doc.data();
      html += `
              <div class="request-item">
                <div>
                  <strong>@${request.username}</strong>
                  <p>Requested: ${new Date(
                    request.requestedAt
                  ).toLocaleString()}</p>
                </div>
                <div class="request-actions">
                  <button class="approve-btn" onclick="approveProjectRequest('${projectId}', '${
        doc.id
      }', '${request.userId}')">
                    Approve
                  </button>
                  <button class="deny-btn" onclick="denyProjectRequest('${projectId}', '${
        doc.id
      }')">
                    Deny
                  </button>
                </div>
              </div>
            `;
    });
    requestsList.innerHTML = html;
  } catch (error) {
    console.error("Error loading requests:", error);
    setContentState(requestsList, "Error loading requests.");
  }
}

async function approveProjectRequest(projectId, requestId, userIdToApprove) {
  try {
    const batch = db.batch();

    // Add user to project members
    const projectRef = db.doc(`projects/${projectId}`);
    batch.update(projectRef, {
      members: firebase.firestore.FieldValue.arrayUnion(userIdToApprove),
    });

    // Delete the request
    const requestRef = db.doc(`projects/${projectId}/requests/${requestId}`);
    batch.delete(requestRef);

    await batch.commit();

    alert("Request approved!");
    manageProjectRequests(projectId); // Refresh the list
  } catch (error) {
    console.error("Error approving request:", error);
    alert("Failed to approve request. Please try again.");
  }
}

async function denyProjectRequest(projectId, requestId) {
  try {
    await db.doc(`projects/${projectId}/requests/${requestId}`).delete();
    alert("Request denied!");
    manageProjectRequests(projectId); // Refresh the list
  } catch (error) {
    console.error("Error denying request:", error);
    alert("Failed to deny request. Please try again.");
  }
}

// --- EVENT MANAGEMENT ---
async function handleJoinEvent(eventId) {
  if (!currentUserData) return;

  try {
    await db.runTransaction(async (transaction) => {
      const eventRef = db.doc(`events/${eventId}`);
      const eventDoc = await transaction.get(eventRef);

      if (!eventDoc.exists) {
        throw new Error("Event not found");
      }

      const event = eventDoc.data();
      const currentAttendeeCount = event.attendeeCount || 0;
      const maxAttendees = event.maxAttendees;

      if (maxAttendees && currentAttendeeCount >= maxAttendees) {
        throw new Error("Event is full");
      }

      // Add user to attendees
      const attendeeRef = db.doc(
        `events/${eventId}/attendees/${currentUserData.id}`
      );
      transaction.set(attendeeRef, {
        joinedAt: new Date().toISOString(),
      });

      // Update attendee count
      transaction.update(eventRef, {
        attendeeCount: currentAttendeeCount + 1,
      });
    });

    alert("Successfully joined event!");
    loadEvents();
  } catch (error) {
    console.error("Error joining event:", error);
    alert(error.message || "Failed to join event. Please try again.");
  }
}

async function handleLeaveEvent(eventId) {
  if (!currentUserData) return;

  try {
    await db.runTransaction(async (transaction) => {
      const eventRef = db.doc(`events/${eventId}`);
      const eventDoc = await transaction.get(eventRef);

      if (!eventDoc.exists) {
        throw new Error("Event not found");
      }

      const event = eventDoc.data();
      const currentAttendeeCount = event.attendeeCount || 1;

      // Remove user from attendees
      const attendeeRef = db.doc(
        `events/${eventId}/attendees/${currentUserData.id}`
      );
      transaction.delete(attendeeRef);

      // Update attendee count
      transaction.update(eventRef, {
        attendeeCount: Math.max(0, currentAttendeeCount - 1),
      });
    });

    alert("Successfully left event!");
    loadEvents();
  } catch (error) {
    console.error("Error leaving event:", error);
    alert("Failed to leave event. Please try again.");
  }
}

// --- EDIT PROFILE ---
function openEditProfileModal() {
  if (!currentUserData) return;

  const modal = document.getElementById("edit-profile-modal");
  const nameInput = document.getElementById("edit-profile-name");
  const bioInput = document.getElementById("edit-profile-bio");
  const emailInput = document.getElementById("edit-profile-email");
  const branchSelect = document.getElementById("edit-profile-branch");

  if (!modal || !nameInput || !bioInput || !emailInput || !branchSelect) return;

  // Pre-fill form with current data
  nameInput.value = currentUserData.name || "";
  bioInput.value = currentUserData.bio || "";
  emailInput.value = currentUserData.email || "";
  branchSelect.value = currentUserData.branch || "";

  modal.style.display = "block";
}

async function saveProfileChanges() {
  const nameInput = document.getElementById("edit-profile-name");
  const bioInput = document.getElementById("edit-profile-bio");
  const emailInput = document.getElementById("edit-profile-email");
  const branchSelect = document.getElementById("edit-profile-branch");

  if (!nameInput) return;

  const name = nameInput.value.trim();
  const bio = bioInput.value.trim();
  const email = emailInput.value.trim();
  const branch = branchSelect.value;

  if (!name) {
    alert("Name is required");
    return;
  }

  const saveBtn = document.getElementById("submit-edit-profile-btn");
  if (saveBtn) saveBtn.disabled = true;

  try {
    await db.collection("users").doc(currentUserData.id).update({
      name: name,
      bio: bio,
      email: email,
      branch: branch,
    });

    // Update local data
    currentUserData.name = name;
    currentUserData.bio = bio;
    currentUserData.email = email;
    currentUserData.branch = branch;

    // Update UI
    const userNameEl = document.getElementById("user-name-desktop");
    if (userNameEl) {
      userNameEl.innerHTML = `
              <img src="${
                currentUserData.profilePhotoUrl ||
                "https://placehold.co/32x32/f3f4f6/6b7280?text=?"
              }" alt="${currentUserData.name}">
              <span>${currentUserData.name}</span>
            `;
    }

    const modal = document.getElementById("edit-profile-modal");
    if (modal) modal.style.display = "none";

    loadProfile();
    alert("Profile updated successfully!");
  } catch (error) {
    console.error("Error updating profile:", error);
    alert("Failed to update profile. Please try again.");
  }

  if (saveBtn) saveBtn.disabled = false;
}

// --- EDIT POST ---
function openEditPostModal(postId, currentText) {
  const modal = document.getElementById("edit-post-modal");
  const textInput = document.getElementById("edit-post-text");
  const postIdInput = document.getElementById("edit-post-id");

  if (!modal || !textInput || !postIdInput) return;

  textInput.value = currentText;
  postIdInput.value = postId;
  modal.style.display = "block";
}

async function savePostChanges() {
  const textInput = document.getElementById("edit-post-text");
  const postIdInput = document.getElementById("edit-post-id");

  if (!textInput || !postIdInput) return;

  const newText = textInput.value.trim();
  const postId = postIdInput.value;

  if (!newText) {
    alert("Post text is required");
    return;
  }

  const saveBtn = document.getElementById("submit-edit-post-btn");
  if (saveBtn) saveBtn.disabled = true;

  try {
    await db.collection("posts").doc(postId).update({
      text: newText,
    });

    const modal = document.getElementById("edit-post-modal");
    if (modal) modal.style.display = "none";

    loadHomeFeed();
    alert("Post updated successfully!");
  } catch (error) {
    console.error("Error updating post:", error);
    alert("Failed to update post. Please try again.");
  }

  if (saveBtn) saveBtn.disabled = false;
}

// --- EDIT COMMENT ---
function openEditCommentModal(postId, commentId, currentText) {
  const modal = document.getElementById("edit-comment-modal");
  const textInput = document.getElementById("edit-comment-text");
  const postIdInput = document.getElementById("edit-comment-post-id");
  const commentIdInput = document.getElementById("edit-comment-id");

  if (!modal || !textInput || !postIdInput || !commentIdInput) return;

  textInput.value = currentText;
  postIdInput.value = postId;
  commentIdInput.value = commentId;
  modal.style.display = "block";
}

async function saveCommentChanges() {
  const textInput = document.getElementById("edit-comment-text");
  const postIdInput = document.getElementById("edit-comment-post-id");
  const commentIdInput = document.getElementById("edit-comment-id");

  if (!textInput || !postIdInput || !commentIdInput) return;

  const newText = textInput.value.trim();
  const postId = postIdInput.value;
  const commentId = commentIdInput.value;

  if (!newText) {
    alert("Comment text is required");
    return;
  }

  const saveBtn = document.getElementById("submit-edit-comment-btn");
  if (saveBtn) saveBtn.disabled = true;

  try {
    await db.collection(`posts/${postId}/comments`).doc(commentId).update({
      text: newText,
    });

    const modal = document.getElementById("edit-comment-modal");
    if (modal) modal.style.display = "none";

    openCommentsModal(postId);
    alert("Comment updated successfully!");
  } catch (error) {
    console.error("Error updating comment:", error);
    alert("Failed to update comment. Please try again.");
  }

  if (saveBtn) saveBtn.disabled = false;
}

// --- PAGE NAVIGATION ---
const navLinks = document.querySelectorAll(".sidebar-link, .mobile-nav-link");
const pages = document.querySelectorAll(".page");

function showPage(pageId) {
  batchUpdateViewCounts();

  navLinks.forEach((l) => l.classList.remove("active"));
  document
    .querySelectorAll(`[data-page="${pageId}"]`)
    .forEach((l) => l.classList.add("active"));

  pages.forEach((p) => p.classList.remove("active"));
  const targetPage = document.getElementById(pageId + "-page");
  if (targetPage) targetPage.classList.add("active");

  if (pageId === "profile") {
    document.querySelector(".main-content").style.width = "100%";
    if (mainContainer) mainContainer.classList.add("profile-layout");
    if (createPostBtn) createPostBtn.style.display = "none";
    loadProfile();
  } else if (pageId === "chat") {
    document.querySelector(".main-content").style.width = "100%";
    document.querySelector("#chat-page").style.display = "flex";
    if (mainContainer) mainContainer.classList.remove("profile-layout");
    if (createPostBtn) createPostBtn.style.display = "none";
    loadChatRooms();
  } else {
    if (mainContainer) mainContainer.classList.remove("profile-layout");
    if (createPostBtn)
      createPostBtn.style.display = pageId === "home" ? "block" : "none";
  }

  if (pageId === "home") {
    loadHomeFeed();
    hideChat();
    //document.querySelector(".main-content").style.width = "60%";
  }
  if (pageId === "projects") {
    loadProjects();
    hideChat();
    //  document.querySelector(".main-content").style.width = "100%";
  }
  if (pageId === "events") {
    loadEvents();
    hideChat();
    // document.querySelector(".main-content").style.width = "70%";
  }
  if (pageId === "groups") {
    loadGroups();
    hideChat();
    //document.querySelector(".main-content").style.width = "100%";
  }
}
function hideChat() {
  document.querySelector("#chat-page").style.display = "none";
}
navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const pageId = link.getAttribute("data-page");
    if (pageId) showPage(pageId);
  });
});

// --- LOGOUT BUTTON ---
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    console.log("Signing out...");
    await batchUpdateViewCounts();
    auth.signOut();
  });
}

// --- MODAL LOGIC ---
const closePostModalBtn = document.getElementById("close-post-modal");
if (createPostBtn && postModal) {
  createPostBtn.onclick = () => (postModal.style.display = "block");
}
if (closePostModalBtn && postModal) {
  closePostModalBtn.onclick = () => (postModal.style.display = "none");
}

const projectModal = document.getElementById("create-project-modal");
const closeProjectModalBtn = document.getElementById("close-project-modal");
const submitProjectBtn = document.getElementById("submit-project-btn");
const showProjectModalBtn = document.getElementById("show-project-modal-btn");

if (showProjectModalBtn && projectModal) {
  showProjectModalBtn.onclick = () => (projectModal.style.display = "block");
}
if (closeProjectModalBtn && projectModal) {
  closeProjectModalBtn.onclick = () => (projectModal.style.display = "none");
}

const commentsModal = document.getElementById("comments-modal");
const closeCommentsModalBtn = document.getElementById("close-comments-modal");
const commentForm = document.getElementById("comment-form");

if (closeCommentsModalBtn && commentsModal) {
  closeCommentsModalBtn.onclick = () => (commentsModal.style.display = "none");
}

// Edit Profile Modal
const editProfileModal = document.getElementById("edit-profile-modal");
const closeEditProfileModalBtn = document.getElementById(
  "close-edit-profile-modal"
);
const showEditProfileModalBtn = document.getElementById(
  "show-edit-profile-modal-btn"
);
const submitEditProfileBtn = document.getElementById("submit-edit-profile-btn");

if (showEditProfileModalBtn && editProfileModal) {
  showEditProfileModalBtn.onclick = () => openEditProfileModal();
}
if (closeEditProfileModalBtn && editProfileModal) {
  closeEditProfileModalBtn.onclick = () =>
    (editProfileModal.style.display = "none");
}
if (submitEditProfileBtn) {
  submitEditProfileBtn.onclick = () => saveProfileChanges();
}

// Edit Post Modal
const editPostModal = document.getElementById("edit-post-modal");
const closeEditPostModalBtn = document.getElementById("close-edit-post-modal");
const submitEditPostBtn = document.getElementById("submit-edit-post-btn");

if (closeEditPostModalBtn && editPostModal) {
  closeEditPostModalBtn.onclick = () => (editPostModal.style.display = "none");
}
if (submitEditPostBtn) {
  submitEditPostBtn.onclick = () => savePostChanges();
}

// Edit Comment Modal
const editCommentModal = document.getElementById("edit-comment-modal");
const closeEditCommentModalBtn = document.getElementById(
  "close-edit-comment-modal"
);
const submitEditCommentBtn = document.getElementById("submit-edit-comment-btn");

if (closeEditCommentModalBtn && editCommentModal) {
  closeEditCommentModalBtn.onclick = () =>
    (editCommentModal.style.display = "none");
}
if (submitEditCommentBtn) {
  submitEditCommentBtn.onclick = () => saveCommentChanges();
}

// Project Requests Modal
const projectRequestsModal = document.getElementById("project-requests-modal");
const closeProjectRequestsModalBtn = document.getElementById(
  "close-project-requests-modal"
);

if (closeProjectRequestsModalBtn && projectRequestsModal) {
  closeProjectRequestsModalBtn.onclick = () =>
    (projectRequestsModal.style.display = "none");
}
const projectMembersModal = document.getElementById("project-members-modal");
const closeProjectMembersModalBtn = document.getElementById(
  "close-project-members-modal"
);
const userProfileModal = document.getElementById("user-profile-modal");
const closeUserProfileModalBtn = document.getElementById(
  "close-user-profile-modal"
);
const eventQRModal = document.getElementById("event-qr-modal");
const closeEventQRModalBtn = document.getElementById("close-event-qr-modal");

if (closeEventQRModalBtn && eventQRModal) {
  closeEventQRModalBtn.onclick = () => (eventQRModal.style.display = "none");
}
if (closeUserProfileModalBtn && userProfileModal) {
  closeUserProfileModalBtn.onclick = () =>
    (userProfileModal.style.display = "none");
}
if (closeProjectMembersModalBtn && projectMembersModal) {
  closeProjectMembersModalBtn.onclick = () =>
    (projectMembersModal.style.display = "none");
}

// Chat functionality
const sendChatMessageBtn = document.getElementById("send-chat-message-btn");
const chatMessageInput = document.getElementById("chat-message-input");

if (sendChatMessageBtn) {
  sendChatMessageBtn.onclick = () => sendChatMessage();
}

if (chatMessageInput) {
  chatMessageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendChatMessage();
    }
  });
}

window.onclick = (event) => {
  if (event.target == postModal && postModal) postModal.style.display = "none";
  if (event.target == projectModal && projectModal)
    projectModal.style.display = "none";
  if (event.target == commentsModal && commentsModal)
    commentsModal.style.display = "none";
  if (event.target == editProfileModal && editProfileModal)
    editProfileModal.style.display = "none";
  if (event.target == editPostModal && editPostModal)
    editPostModal.style.display = "none";
  if (event.target == editCommentModal && editCommentModal)
    editCommentModal.style.display = "none";
  if (event.target == projectRequestsModal && projectRequestsModal)
    projectRequestsModal.style.display = "none";
  if (event.target == projectMembersModal && projectMembersModal)
    projectMembersModal.style.display = "none";
  if (event.target == userProfileModal && userProfileModal)
    userProfileModal.style.display = "none";
  if (event.target == eventQRModal && eventQRModal)
    eventQRModal.style.display = "none";
};

// --- FORM SUBMISSION ---
if (submitPostBtn) {
  submitPostBtn.addEventListener("click", async () => {
    const postTextInput = document.getElementById("post-text-input");
    const postImageInput = document.getElementById("post-image-input");

    if (!postTextInput || !postImageInput) return;

    const text = postTextInput.value;
    let file = postImageInput.files[0];

    if (!text && !file) {
      alert("Write something or upload an image.");
      return;
    }
    if (!currentUserData) {
      alert("User not loaded.");
      return;
    }

    submitPostBtn.disabled = true;
    submitPostBtn.innerText = "Posting...";

    try {
      let imageUrl = null;

      if (file) {
        submitPostBtn.innerText = "Compressing image...";
        console.log(`Original file size: ${file.size / 1024 / 1024} MB`);

        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };

        const compressedFile = await imageCompression(file, options);
        console.log(
          `Compressed file size: ${compressedFile.size / 1024 / 1024} MB`
        );

        submitPostBtn.innerText = "Uploading image...";
        const storageRef = storage.ref(
          `post_images/${currentUserData.id}/${Date.now()}_${
            compressedFile.name
          }`
        );
        const snapshot = await storageRef.put(compressedFile);
        imageUrl = await snapshot.ref.getDownloadURL();
      }

      submitPostBtn.innerText = "Saving post...";

      const batch = db.batch();

      // 1. Add the post
      const postRef = db.collection("posts").doc();
      batch.set(postRef, {
        authorId: currentUserData.id,
        authorUsername: currentUserData.username,
        authorPhoto: currentUserData.profilePhotoUrl,
        text: text,
        imageUrl: imageUrl,
        createdAt: new Date().toISOString(),
        likeCount: 0,
        commentCount: 0,
        viewCount: 0,
      });

      // 2. Update user's post count
      const userRef = db.collection("users").doc(currentUserData.id);
      batch.update(userRef, {
        postCount: firebase.firestore.FieldValue.increment(1),
      });

      await batch.commit();

      postTextInput.value = "";
      postImageInput.value = null;
      if (postModal) postModal.style.display = "none";
      loadHomeFeed();
    } catch (error) {
      console.error("Error creating post:", error);
      alert("Error: " + error.message);
    }
    submitPostBtn.disabled = false;
    submitPostBtn.innerHTML =
      '<span class="material-symbols-outlined">check</span> Post';
  });
}

// Handle Project Submit
if (submitProjectBtn) {
  submitProjectBtn.addEventListener("click", async () => {
    const titleInput = document.getElementById("project-title-input");
    const descInput = document.getElementById("project-desc-input");
    const skillsInput = document.getElementById("project-skills-input");
    const membersInput = document.getElementById("project-members-input");

    if (!titleInput || !descInput || !membersInput) return;

    const title = titleInput.value;
    const desc = descInput.value;
    const skills = skillsInput ? skillsInput.value : "";
    const members = membersInput.valueAsNumber;

    if (!title || !desc || !members) {
      alert("Please fill in all required fields.");
      return;
    }

    submitProjectBtn.disabled = true;
    submitProjectBtn.innerText = "Posting...";

    try {
      const skillsArray = skills
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);

      await db.collection("projects").add({
        ownerId: currentUserData.id,
        ownerUsername: currentUserData.username,
        title: title,
        description: desc,
        skillsRequired: skillsArray,
        membersNeeded: members,
        members: [currentUserData.id],
        createdAt: new Date().toISOString(),
      });

      if (projectModal) projectModal.style.display = "none";
      showPage("projects");
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Error creating project: " + error.message);
    }

    submitProjectBtn.disabled = false;
    submitProjectBtn.innerHTML =
      '<span class="material-symbols-outlined">check</span> Post Project';
  });
}

// --- LIKES & COMMENTS ---
async function handleLikeClick(postId) {
  if (!currentUserData) return;

  const likeRef = db.doc(`posts/${postId}/likes/${currentUserData.id}`);
  const postRef = db.doc(`posts/${postId}`);
  const likeCountSpan = document.getElementById(`like-count-${postId}`);

  if (!likeCountSpan) return;

  const likeButton = likeCountSpan.parentElement;

  try {
    const doc = await likeRef.get();
    const batch = db.batch();

    if (doc.exists) {
      batch.delete(likeRef);
      batch.update(postRef, {
        likeCount: firebase.firestore.FieldValue.increment(-1),
      });
      likeCountSpan.innerText = parseInt(likeCountSpan.innerText) - 1;
      if (likeButton) likeButton.classList.remove("liked");
    } else {
      batch.set(likeRef, { likedAt: new Date() });
      batch.update(postRef, {
        likeCount: firebase.firestore.FieldValue.increment(1),
      });
      likeCountSpan.innerText = parseInt(likeCountSpan.innerText) + 1;
      if (likeButton) likeButton.classList.add("liked");
    }

    await batch.commit();
  } catch (error) {
    console.error("Error liking post:", error);
    alert("Failed to update like. Please try again.");
  }
}

async function openCommentsModal(postId) {
  currentPostIdForComments = postId;
  if (commentsModal) commentsModal.style.display = "block";

  const commentList = document.getElementById("comment-list");
  if (!commentList) return;

  setContentState(commentList, "Loading comments...");

  try {
    const snapshot = await db
      .collection(`posts/${postId}/comments`)
      .orderBy("createdAt", "asc")
      .get();

    if (snapshot.empty) {
      setContentState(commentList, "No comments yet.");
      return;
    }

    let html = "";
    snapshot.forEach((doc) => {
      const comment = doc.data();
      const commentId = doc.id;

      const actionsHtml =
        comment.authorId === currentUserData.id
          ? `
                
              <div class="comment-actions">

                <button class="edit-comment-btn" onclick="openEditCommentModal('${postId}', '${commentId}', \`${comment.text.replace(
              /`/g,
              "\\`"
            )}\`)">
                  <span class="material-symbols-outlined">edit</span>
                </button>
                <button class="delete-comment-btn" onclick="handleDeleteComment('${postId}', '${commentId}')">
                  <span class="material-symbols-outlined">delete</span>
                </button>
              </div>
            `
          : "";

      html += `
  <div class="comment-item">
    <div class="comment-text">
      <strong>@${comment.authorUsername}</strong>
      <p>${escapeHtml(comment.text)}</p>
    </div>
    ${actionsHtml}
  </div>
`;
    });
    commentList.innerHTML = html;
  } catch (error) {
    console.error("Error loading comments:", error);
    setContentState(commentList, "Error loading comments.");
  }
}

async function handleDeleteComment(postId, commentId) {
  console.log(`Deleting comment: ${commentId}`);

  try {
    const commentRef = db.doc(`posts/${postId}/comments/${commentId}`);
    const postRef = db.doc(`posts/${postId}`);

    const batch = db.batch();
    batch.delete(commentRef);
    batch.update(postRef, {
      commentCount: firebase.firestore.FieldValue.increment(-1),
    });

    await batch.commit();

    openCommentsModal(postId);
    loadHomeFeed();
  } catch (error) {
    console.error("Error deleting comment:", error);
    alert("Could not delete comment.");
  }
}

if (commentForm) {
  commentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentPostIdForComments || !currentUserData) return;

    const commentInput = document.getElementById("comment-text-input");
    if (!commentInput) return;

    const text = commentInput.value;
    if (!text) return;

    const commentBtn = commentForm.querySelector("button");
    if (commentBtn) commentBtn.disabled = true;

    try {
      const batch = db.batch();

      // 1. Add the comment
      const commentRef = db
        .collection(`posts/${currentPostIdForComments}/comments`)
        .doc();
      batch.set(commentRef, {
        authorId: currentUserData.id,
        authorUsername: currentUserData.username,
        text: text,
        createdAt: new Date().toISOString(),
      });

      // 2. Update post's commentCount
      const postRef = db.doc(`posts/${currentPostIdForComments}`);
      batch.update(postRef, {
        commentCount: firebase.firestore.FieldValue.increment(1),
      });

      await batch.commit();

      commentInput.value = "";
      openCommentsModal(currentPostIdForComments);
      loadHomeFeed();
    } catch (error) {
      console.error("Error posting comment:", error);
      alert("Failed to post comment. Please try again.");
    }
    if (commentBtn) commentBtn.disabled = false;
  });
}

// --- BATCH UPDATE VIEW COUNTS WITH ERROR HANDLING ---
async function batchUpdateViewCounts() {
  if (isUploadingViews || viewedPostIds.size === 0) {
    return;
  }

  isUploadingViews = true;
  console.log(`Batch updating view counts for ${viewedPostIds.size} posts...`);

  try {
    const batch = db.batch();
    const postsToUpdate = Array.from(viewedPostIds);

    // Firestore batch limit is 500 operations
    if (postsToUpdate.length > 500) {
      console.warn("Too many posts to update at once. Splitting into chunks.");
      const chunks = [];
      for (let i = 0; i < postsToUpdate.length; i += 500) {
        chunks.push(postsToUpdate.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const chunkBatch = db.batch();
        chunk.forEach((postId) => {
          const postRef = db.doc(`posts/${postId}`);
          chunkBatch.update(postRef, {
            viewCount: firebase.firestore.FieldValue.increment(1),
          });
        });
        await chunkBatch.commit();
      }
    } else {
      postsToUpdate.forEach((postId) => {
        const postRef = db.doc(`posts/${postId}`);
        batch.update(postRef, {
          viewCount: firebase.firestore.FieldValue.increment(1),
        });
      });
      await batch.commit();
    }

    console.log("View counts updated successfully.");
    viewedPostIds.clear();
  } catch (error) {
    console.error("Error batch updating view counts:", error);
    // Don't clear viewedPostIds on error - try again later
  }

  isUploadingViews = false;
}

// Helper function to set content state
function setContentState(element, message) {
  if (element) {
    element.innerHTML = `<p>${message}</p>`;
  }
}

// Add visibility change listener
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    batchUpdateViewCounts();
  }
});

// Add beforeunload listener for safety
window.addEventListener("beforeunload", (e) => {
  if (viewedPostIds.size > 0) {
    batchUpdateViewCounts();
  }
});
// --- PROFILE ENHANCEMENTS ---
async function loadProfileEvents() {
  const profileEventsContent = document.getElementById("profile-events-list");
  if (!profileEventsContent) return;
  try {
    // Get all events where user is an attendee
    const eventsSnapshot = await db.collection("events").get();
    const userEvents = [];
    // Check each event if user has joined
    for (const doc of eventsSnapshot.docs) {
      const attendeeDoc = await db
        .doc(`events/${doc.id}/attendees/${currentUserData.id}`)
        .get();
      if (attendeeDoc.exists) {
        userEvents.push({ id: doc.id, ...doc.data() });
      }
    }
    if (userEvents.length === 0) {
      profileEventsContent.innerHTML = "<p>No events joined yet.</p>";
      return;
    }
    let html = "<h3>Events Joined</h3>";
    userEvents.forEach((event) => {
      html += `
        <div class="card">
          <h4>${event.title}</h4>
          <p class="card-meta">Date: ${new Date(
            event.date
          ).toLocaleString()} | Location: ${event.location}</p>
          <p>${event.description}</p>
          <button class="card-button danger" onclick="handleLeaveEvent('${
            event.id
          }')">
            <span class="material-symbols-outlined">logout</span> Leave Event
          </button>
        </div>
      `;
    });
    profileEventsContent.innerHTML = html;
  } catch (error) {
    console.error("Error loading profile events:", error);
    profileEventsContent.innerHTML = "<p>Error loading events.</p>";
  }
}
async function loadProfileProjects() {
  const profileProjectsContent = document.getElementById(
    "profile-projects-list"
  );
  if (!profileProjectsContent) return;
  try {
    // Get projects where user is a member
    const projectsSnapshot = await db
      .collection("projects")
      .where("members", "array-contains", currentUserData.id)
      .get();
    if (projectsSnapshot.empty) {
      profileProjectsContent.innerHTML = "<p>No projects joined yet.</p>";
      return;
    }
    let html = "<h3>Projects Joined</h3>";
    projectsSnapshot.forEach((doc) => {
      const project = doc.data();
      const isOwner = project.ownerId === currentUserData.id;
      html += `
        <div class="card">
          <h4>${project.title}</h4>
          <p class="card-meta">By @${project.ownerUsername} | Members: ${
        project.members.length
      }/${project.membersNeeded}</p>
          <p>${project.description}</p>
          <div class="skills-list">
            ${(project.skillsRequired || [])
              .map((skill) => `<span class="skill-tag">${skill}</span>`)
              .join("")}
          </div>
          ${
            isOwner
              ? `<button class="card-button secondary" disabled>
              <span class="material-symbols-outlined">star</span> Project Owner
            </button>`
              : `<button class="card-button danger" onclick="leaveProject('${doc.id}')">
              <span class="material-symbols-outlined">exit_to_app</span> Leave Project
            </button>`
          }
        </div>
      `;
    });
    profileProjectsContent.innerHTML = html;
  } catch (error) {
    console.error("Error loading profile projects:", error);
    profileProjectsContent.innerHTML = "<p>Error loading projects.</p>";
  }
}
async function loadProfilePosts() {
  const profilePostsContent = document.getElementById("profile-posts-list");
  if (!profilePostsContent) return;
  try {
    const snapshot = await db
      .collection("posts")
      .where("authorId", "==", currentUserData.id)
      .orderBy("createdAt", "desc")
      .get();
    if (snapshot.empty) {
      profilePostsContent.innerHTML = "<p>No posts yet.</p>";
      return;
    }
    let html = "<h3>My Posts</h3>";
    snapshot.forEach((doc) => {
      const post = doc.data();
      const postId = doc.id;
      html += `
        <div class="card">
          <div class="card-header">
            <img src="${
              post.authorPhoto ||
              "https://placehold.co/40x40/f3f4f6/6b7280?text=?"
            }" alt="${post.authorUsername}">
            <div class="author-info">
              <strong>${post.authorUsername}</strong>
              <span>${new Date(post.createdAt).toLocaleString()}</span>
            </div>
          </div>
          <div class="card-body">
        <p>${escapeHtml(post.text)}</p>
            ${
              post.imageUrl
                ? `<img src="${post.imageUrl}" class="post-image" style="height:auto;">`
                : ""
            }
            <div class="post-actions">
              <button class="action-btn" title="Edit Post" onclick="openEditPostModal('${postId}', \`${post.text.replace(
        /`/g,
        "\\`"
      )}\`)">
                <span class="material-symbols-outlined">edit</span>
              </button>
              <button class="action-btn" title="Delete Post" onclick="handleDeletePost('${postId}')">
                <span class="material-symbols-outlined">delete</span>
              </button>
            </div>
          </div>
          <div class="card-footer">
            <div class="footer-action">
              <span class="material-symbols-outlined">thumb_up</span> 
              <span>${post.likeCount || 0}</span> Likes
            </div>
            <div class="footer-action">
              <span class="material-symbols-outlined">chat_bubble</span>
              <span>${post.commentCount || 0}</span> Comments
            </div>
            <div class="footer-action">
              <span class="material-symbols-outlined">visibility</span>
              <span>${post.viewCount || 0}</span> Views
            </div>
          </div>
        </div>
      `;
    });
    profilePostsContent.innerHTML = html;
  } catch (error) {
    console.error("Error loading profile posts:", error);
    profilePostsContent.innerHTML = "<p>Error loading posts.</p>";
  }
}
async function handleDeletePost(postId) {
  if (
    !confirm(
      "Are you sure you want to delete this post? This action cannot be undone."
    )
  ) {
    return;
  }
  try {
    const batch = db.batch();
    const postRef = db.doc(`posts/${postId}`);
    // Delete the post
    batch.delete(postRef);
    // Decrement user's post count
    const userRef = db.collection("users").doc(currentUserData.id);
    batch.update(userRef, {
      postCount: firebase.firestore.FieldValue.increment(-1),
    });
    await batch.commit();
    alert("Post deleted successfully!");
    loadProfilePosts(); // Refresh the posts list
    loadHomeFeed(); // Refresh home feed if needed
  } catch (error) {
    console.error("Error deleting post:", error);
    alert("Failed to delete post. Please try again.");
  }
}
async function leaveProject(projectId) {
  if (!confirm("Are you sure you want to leave this project?")) {
    return;
  }
  try {
    const projectRef = db.doc(`projects/${projectId}`);
    await projectRef.update({
      members: firebase.firestore.FieldValue.arrayRemove(currentUserData.id),
    });
    alert("Successfully left the project!");
    loadProfileProjects(); // Refresh projects list
    loadProjects(); // Refresh main projects page
  } catch (error) {
    console.error("Error leaving project:", error);
    alert("Failed to leave project. Please try again.");
  }
}
async function showProjectMembers(projectId) {
  const modal = document.getElementById("project-members-modal");
  const membersList = document.getElementById("project-members-list");
  if (!modal || !membersList) return;
  setContentState(membersList, "Loading members...");
  modal.style.display = "block";
  try {
    const projectDoc = await db.collection("projects").doc(projectId).get();
    if (!projectDoc.exists) {
      setContentState(membersList, "Project not found.");
      return;
    }
    const project = projectDoc.data();
    const memberIds = project.members || [project.ownerId]; // Include owner
    // Fetch all member details
    const memberPromises = memberIds.map((memberId) =>
      db.collection("users").doc(memberId).get()
    );
    const memberSnapshots = await Promise.all(memberPromises);
    const members = memberSnapshots.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    let html = "";
    members.forEach((member) => {
      const isOwner = member.id === project.ownerId;
      html += `
  <div class="member-item">
    <img src="${
      member.profilePhotoUrl ||
      "https://placehold.co/40x40/f3f4f6/6b7280?text=?"
    }" alt="${member.name}" 
         style="cursor: pointer;" onclick="showUserProfile('${member.id}')">
    <div class="member-info">
      <strong style="cursor: pointer;" onclick="showUserProfile('${
        member.id
      }')">${member.name} ${isOwner ? "(Owner)" : ""}</strong>
      <span>@${member.username}</span>
    </div>
    ${
      isOwner
        ? '<span class="material-symbols-outlined" style="color: var(--primary-blue);">star</span>'
        : ""
    }
  </div>
`;
    });
    membersList.innerHTML = html;
  } catch (error) {
    console.error("Error loading project members:", error);
    setContentState(membersList, "Error loading members.");
  }
}
async function showUserProfile(userId) {
  const modal = document.getElementById("user-profile-modal");
  const content = document.getElementById("user-profile-content");
  if (!modal || !content) return;
  setContentState(content, "Loading profile...");
  modal.style.display = "block";
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      setContentState(content, "User not found.");
      return;
    }
    const user = userDoc.data();
    const html = `
      <div class="user-profile-header">
        <img src="${
          user.profilePhotoUrl ||
          "https://placehold.co/80x80/f3f4f6/6b7280?text=?"
        }" alt="${user.name}">
        <div class="user-profile-info">
          <h3>${user.name}</h3>
          <p>@${user.username}</p>
          ${
            user.branch
              ? `<p><span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;">school</span> ${user.branch}</p>`
              : ""
          }
        </div>
      </div>
      <div class="user-profile-details">
        ${user.bio ? `<p><strong>Bio:</strong> ${user.bio}</p>` : ""}
        ${user.email ? `<p><strong>Email:</strong> ${user.email}</p>` : ""}
        <p><strong>Posts:</strong> ${user.postCount || 0}</p>
        <p><strong>Projects:</strong> ${user.projectsJoined || 0}</p>
        <p><strong>Events Joined:</strong> ${user.eventsJoined || 0}</p>
      </div>
    `;
    content.innerHTML = html;
  } catch (error) {
    console.error("Error loading user profile:", error);
    setContentState(content, "Error loading profile.");
  }
}
async function showEventQR(eventId) {
  const modal = document.getElementById("event-qr-modal");
  const qrContainer = document.getElementById("qr-code-container");
  const userInfo = document.getElementById("qr-user-info");
  if (!modal || !qrContainer) return;
  qrContainer.innerHTML = "<p>Generating QR code...</p>";
  userInfo.innerHTML = "";
  modal.style.display = "block";
  try {
    const eventDoc = await db.collection("events").doc(eventId).get();
    const event = eventDoc.data();
    // Create QR data
    const qrData = JSON.stringify({
      eventId: eventId,
      userId: currentUserData.id,
      username: currentUserData.username,
      name: currentUserData.name,
      eventTitle: event.title,
      timestamp: new Date().toISOString(),
    });
    // Check if QRCodeStyling is available
    if (typeof QRCodeStyling === "undefined") {
      throw new Error("QR code library not loaded");
    }
    // Create QR code
    const qrCode = new QRCodeStyling({
      width: 250,
      height: 250,
      data: qrData,
      // Use a text label instead
      image:
        "data:image/svg+xml;base64," +
        btoa(
          '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="20" viewBox="0 0 50 20"><text x="25" y="15" font-family="Arial" font-size="12" text-anchor="middle" fill="#1d4ed8">Trubond</text></svg>'
        ),
      dotsOptions: {
        color: "#1d4ed8",
        type: "rounded",
      },
      backgroundOptions: {
        color: "#ffffff",
      },
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 5,
        imageSize: 0.4, // 40% of QR code size
      },
    });
    // Clear and render QR code
    qrContainer.innerHTML = "";
    qrCode.append(qrContainer);
    // Show user info
    userInfo.innerHTML = `
      <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin-top: 15px;">
        <h4 style="margin: 0 0 10px 0; color: #1d4ed8;">${event.title}</h4>
        <p style="margin: 5px 0;"><strong>Name:</strong> ${
          currentUserData.name
        }</p>
        <p style="margin: 5px 0;"><strong>Username:</strong> @${
          currentUserData.username
        }</p>
        <p style="margin: 5px 0;"><strong>Event:</strong> ${event.title}</p>
        <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      </div>
    `;
  } catch (error) {
    console.error("Error generating QR code:", error);
    // Fallback to text code if QR fails
    const verificationCode = `${currentUserData.username}-${eventId
      .substring(0, 6)
      .toUpperCase()}`;
    qrContainer.innerHTML = `
      <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 10px; border: 2px dashed #1d4ed8;">
        <h3 style="color: #1d4ed8; margin-bottom: 15px;">⚠️ QR Code Unavailable</h3>
        <p>Using verification code instead:</p>
        <div style="font-family: monospace; font-size: 1.4rem; font-weight: bold; color: #1d4ed8; background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
          ${verificationCode}
        </div>
        <p style="color: #6b7280; font-size: 0.9rem;">
          Show this code at the event entrance
        </p>
      </div>
    `;
  }
}
function closeQRModal() {
  const modal = document.getElementById("event-qr-modal");
  if (modal) modal.style.display = "none";
}
// HTML Escape Function - PREVENTS XSS
function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
// Make functions globally accessible
window.handleLikeClick = handleLikeClick;
window.openCommentsModal = openCommentsModal;
window.handleDeleteComment = handleDeleteComment;
window.openChatRoom = openChatRoom;
window.handleProjectRequest = handleProjectRequest;
window.manageProjectRequests = manageProjectRequests;
window.approveProjectRequest = approveProjectRequest;
window.denyProjectRequest = denyProjectRequest;
window.handleJoinEvent = handleJoinEvent;
window.handleLeaveEvent = handleLeaveEvent;
window.openEditProfileModal = openEditProfileModal;
window.openEditPostModal = openEditPostModal;
window.openEditCommentModal = openEditCommentModal;
window.handleDeletePost = handleDeletePost;
window.leaveProject = leaveProject;
window.handleDeleteProject = handleDeleteProject;
window.showUserProfile = showUserProfile;
window.showEventQR = showEventQR;
window.closeQRModal = closeQRModal;
window.formatFirestoreTimestamp = formatFirestoreTimestamp;
