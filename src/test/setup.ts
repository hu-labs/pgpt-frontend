import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// Unmount rendered components between tests to avoid DOM/state leaking across tests.
afterEach(cleanup);

import { setStorageUser } from "../lib/storage";

beforeEach(() => setStorageUser("test-user"));
