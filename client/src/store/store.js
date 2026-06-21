/**
 * client/src/store/store.js
 *
 * Slices persisted to localStorage:
 *   auth     — token, refreshToken, user
 *   ui       — theme, language
 *   document — documents list + currentDocument (offline viewing)
 *   chat     — currentSession + messages (resume after reconnection)
 */

import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage"; // localStorage

import authReducer from "./slices/authSlice";
import uiReducer from "./slices/uiSlice";
import chatReducer from "./slices/chatSlice";
import documentReducer from "./slices/documentSlice";
import caseReducer from "./slices/caseSlice";
import subscriptionReducer from "./slices/subscriptionSlice";
import notificationReducer from "./slices/notificationSlice";
import lawyerReducer from "./slices/lawyerSlice";
import errorReducer from "./slices/errorSlice";
import nyayabotReducer from './slices/nyayabotSlice';
import consultationChatReducer from './slices/consultationChatSlice';
import notaryReducer from './slices/notarySlice';
import rtiReducer from './slices/rtiSlice';
// ─── Persist configs ─────────────────────────────────────────────────────────

const authPersistConfig = {
  key: "nyayasetu_auth",
  storage,
  whitelist: ["token", "refreshToken", "user"], // never persist loading / error
};

const uiPersistConfig = {
  key: "nyayasetu_ui",
  storage,
  whitelist: ["theme", "language"],
};

// Persist the document list and the currently-open document so rural users
// can browse their documents even when connectivity drops.
const documentPersistConfig = {
  key: "nyayasetu_documents",
  storage,
  whitelist: ["documents", "currentDocument", "total"],
};

// Persist the active chat session so an in-progress interview survives a
// network interruption; ChatFlow's ResumeDialog picks it up on reconnect.
const chatPersistConfig = {
  key: "nyayasetu_chat",
  storage,
  whitelist: ["currentSession", "messages"],
};

// ─── Root reducer ─────────────────────────────────────────────────────────────

const rootReducer = combineReducers({
  error: errorReducer,
  auth: persistReducer(authPersistConfig, authReducer),
  ui: persistReducer(uiPersistConfig, uiReducer),
  chat: persistReducer(chatPersistConfig, chatReducer),
  nyayabot: nyayabotReducer,
  document: persistReducer(documentPersistConfig, documentReducer),
  case: caseReducer,
  subscription: subscriptionReducer,
  notification: notificationReducer,
  lawyer: lawyerReducer,
  consultationChat: consultationChatReducer,
  notary: notaryReducer,
  rti: rtiReducer,
});

// ─── Store ───────────────────────────────────────────────────────────────────

const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // redux-persist dispatches non-serialisable actions — ignore them
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
  devTools: import.meta.env.DEV,
});

export const persistor = persistStore(store);

export default store;

/**
 * @typedef {ReturnType<typeof store.getState>} RootState
 * @typedef {typeof store.dispatch} AppDispatch
 */
