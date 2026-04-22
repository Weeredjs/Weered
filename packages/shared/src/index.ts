// @weered/shared — types and constants shared by web, mobile, desktop clients.
//
// The API (apps/api/src/index.ts) is the single source of truth for data
// shapes and business rules. This package mirrors its response types so
// clients don't drift out of sync when the API changes.
//
// Rule of thumb: if a type appears in two or more clients, it belongs here.
// If it's UI-only (colors, icon maps, component props), keep it in the client.

export * from "./user";
export * from "./lobby";
export * from "./friend";
export * from "./activity";
export * from "./notoriety";
export * from "./news";
