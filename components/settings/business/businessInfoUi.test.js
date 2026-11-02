import { describe, expect, it } from "vitest"
import { describeStatus, identityToBody, identityToForm, locationToBody, locationToForm, newSessionToken, parseCoordinate, placeToForm, validateIdentity, validateLocation } from "./businessInfoUi"

const good = () => ({ ...locationToForm(null), address: "12 Gangapur Rd, Nashik", lat: "19.9975", lng: "73.7898" })

describe("businessInfoUi", () => {
  it("parses only plain decimal coordinates", () => {
    expect(parseCoordinate("19.9975")).toBe(19.9975)
    expect(parseCoordinate(" -73.5 ")).toBe(-73.5)
    for (const bad of ["", "abc", "1e5", "NaN", "Infinity", "1,5", "0x10", null, undefined]) expect(parseCoordinate(bad)).toBeNull()
  })
  it("validates a location like the server does", () => {
    expect(validateLocation(good())).toEqual({})
    expect(validateLocation({ ...good(), address: " " }).address).toBeTruthy()
    expect(validateLocation({ ...good(), lat: "91" }).lat).toMatch(/-90 and 90/)
    expect(validateLocation({ ...good(), lng: "-181" }).lng).toMatch(/-180 and 180/)
    expect(validateLocation({ ...good(), lat: "x" }).lat).toBeTruthy()
    expect(validateLocation({ ...good(), lat: "0", lng: "0" }).lat).toMatch(/not a real/)
    expect(validateLocation({ ...good(), countryCode: "IND" }).countryCode).toBeTruthy()
    expect(validateLocation({ ...good(), countryCode: "in" })).toEqual({})
  })
  it("builds the save body: trimmed, numeric, and confirmed only when the caller says so", () => {
    const b = locationToBody({ ...good(), city: " Nashik ", placeId: "" }, { confirmed: true, coordinatesAdjusted: true })
    expect(b).toMatchObject({ confirmed: true, address: "12 Gangapur Rd, Nashik", city: "Nashik", lat: 19.9975, lng: 73.7898, placeId: null, coordinatesAdjusted: true })
    expect(locationToBody(good(), { confirmed: undefined }).confirmed).toBe(false)
  })
  it("a picked place fills the form; parts Google did not return stay empty", () => {
    const f = placeToForm({ placeId: "P1234567890", name: "KEC", address: "A", city: null, location: { lat: 1.5, lng: 2.5 } })
    expect(f).toMatchObject({ placeId: "P1234567890", city: "", state: "", lat: "1.5", lng: "2.5" })
  })
  it("identity: converts both ways, validates counts and lengths", () => {
    const f = identityToForm({ businessName: "K", services: ["a"], secondaryCategories: null })
    expect(f).toMatchObject({ businessName: "K", services: ["a"], secondaryCategories: [], industry: "" })
    expect(identityToBody({ ...f, industry: "" }).industry).toBeNull()
    expect(validateIdentity({ ...f, services: Array.from({ length: 31 }, (_, i) => `s${i}`) }).services).toBeTruthy()
    expect(validateIdentity({ ...f, businessName: "x".repeat(201) }).businessName).toBeTruthy()
  })
  it("status text never claims Business Profile verification", () => {
    for (const s of ["confirmed", "unconfirmed", "missing", "weird"]) expect(JSON.stringify(describeStatus(s))).not.toMatch(/verified by google|ownership verified|business profile verified/i)
    expect(describeStatus("weird").label).toBe(describeStatus("missing").label)
  })
  it("session tokens fit the server pattern and differ", () => {
    const a = newSessionToken(); const b = newSessionToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{16,64}$/)
    expect(a).not.toBe(b)
  })
})
