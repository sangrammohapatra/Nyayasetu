/**
 * client/src/store/store.js
 *
 * redux-persist is used for auth + ui slices only.
 * All other slices use plain in-memory state (re-hydrated from the API on mount).
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

// ─── Root reducer ─────────────────────────────────────────────────────────────

const rootReducer = combineReducers({
  error: errorReducer,
  auth: persistReducer(authPersistConfig, authReducer),
  ui: persistReducer(uiPersistConfig, uiReducer),
  chat: chatReducer,
  document: documentReducer,
  case: caseReducer,
  subscription: subscriptionReducer,
  notification: notificationReducer,
  lawyer: lawyerReducer,
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
