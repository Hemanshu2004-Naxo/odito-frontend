import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import "@testing-library/jest-dom/vitest"
import { render, screen, waitFor, fireEvent, cleanup, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const svc = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), autocomplete: vi.fn(), placeDetails: vi.fn() }))
vi.mock("@/services/businessInfoService", () => ({ default: svc, businessInfoService: svc }))

import BusinessInformationSection from "./BusinessInformationSection"

const dto = (over = {}) => ({
  identity: { businessName: "Krishna Eye Centre", website: "https://krishnaeyecentre.com/", industry: "healthcare", subIndustry: "eye hospital", businessType: "clinic", primaryCategory: "", secondaryCategories: [], services: ["Cataract"] },
  location: null,
  verification: { status: "missing", source: null, confirmedAt: null, coordinatesAdjusted: false, updatedAt: null, googleBusinessProfileConnected: false },
  targetLocation: { city: null, state: null },
  ...over,
})
const confirmedDto = () => dto({
  location: { placeId: "ChIJ_valid-Place123", name: "KEC", address: "12 Gangapur Rd, Nashik", addressLine: "12 Gangapur Rd", city: "Nashik", state: "Maharashtra", country: "India", countryCode: "IN", postalCode: "422013", lat: 19.9975, lng: 73.7898 },
  verification: { status: "confirmed", source: "google_places", confirmedAt: "2026-11-02T10:00:00Z", coordinatesAdjusted: false, updatedAt: "2026-11-02T10:00:00Z", googleBusinessProfileConnected: false },
})
const apiError = (message, status = 400, code = "VALIDATION_ERROR") => Object.assign(new Error(message), { status, code })

function renderIt() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><BusinessInformationSection projectId="p1" /></QueryClientProvider>)
}
const picked = { placeId: "ChIJ_picked-Place1", name: "Krishna Eye Centre", address: "12 Gangapur Rd, Nashik 422013, India", addressLine: "12 Gangapur Rd", city: "Nashik", state: "Maharashtra", country: "India", countryCode: "IN", postalCode: "422013", website: null, location: { lat: 19.9975, lng: 73.7898 } }
const sug = [{ placeId: "ChIJ_picked-Place1", text: "Krishna Eye Centre, Nashik", primary: "Krishna Eye Centre", secondary: "Nashik" }, { placeId: "ChIJ_other-Place123", text: "Other", primary: "Other Clinic", secondary: "Pune" }]

beforeEach(() => { Object.values(svc).forEach((f) => f.mockReset()) })
afterEach(cleanup)

describe("Business Information section", () => {
  test("shows loading, then the three parts; with no location the status says so and Odito does not guess", async () => {
    svc.get.mockResolvedValue({ data: dto() })
    renderIt()
    expect(screen.getByTestId("business-loading")).toBeInTheDocument()
    expect(await screen.findByTestId("business-location-card")).toBeInTheDocument()
    expect(screen.getByTestId("verification-status")).toHaveTextContent("No business location")
    expect(screen.getByTestId("business-identity-card")).toBeInTheDocument()
    expect(screen.getByLabelText("Full address")).toHaveValue("")
    expect(screen.getByLabelText("Business name")).toHaveValue("Krishna Eye Centre")
    expect(screen.getByLabelText("Website")).toBeDisabled()
    expect(screen.getByTestId("location-save")).toBeDisabled()
  })

  test("a load failure is shown with a retry", async () => {
    svc.get.mockRejectedValueOnce(apiError("Server down", 500)).mockResolvedValueOnce({ data: dto() })
    renderIt()
    expect(await screen.findByTestId("business-error")).toHaveTextContent("Server down")
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByTestId("business-location-card")).toBeInTheDocument()
  })

  test("an onboarding location is prefilled but NOT treated as confirmed", async () => {
    svc.get.mockResolvedValue({ data: dto({ location: confirmedDto().location, verification: { ...dto().verification, status: "unconfirmed", source: "google_places" } }) })
    renderIt()
    expect(await screen.findByTestId("location-unconfirmed-note")).toBeInTheDocument()
    expect(screen.getByLabelText("Full address")).toHaveValue("12 Gangapur Rd, Nashik")
    expect(screen.getByTestId("verification-status")).toHaveTextContent("Needs your confirmation")
    expect(screen.getByTestId("location-save")).toHaveTextContent("Confirm location")
    expect(screen.getByTestId("location-save")).toBeDisabled()
    svc.save.mockResolvedValue({ data: confirmedDto() })
    fireEvent.click(screen.getByTestId("location-confirm"))
    fireEvent.click(screen.getByTestId("location-save"))
    await waitFor(() => expect(svc.save).toHaveBeenCalled())
    const body = svc.save.mock.calls[0][1]
    expect(body.location).toMatchObject({ confirmed: true, lat: 19.9975, lng: 73.7898, placeId: "ChIJ_valid-Place123" })
    expect(body.identity).toBeUndefined()
  })

  test("search lists suggestions but never auto-selects; Enter alone picks nothing; clicking one loads it with the SAME session token and fills the form without saving", async () => {
    svc.get.mockResolvedValue({ data: dto() })
    svc.autocomplete.mockResolvedValue({ data: { suggestions: sug } })
    svc.placeDetails.mockResolvedValue({ data: { place: picked } })
    renderIt()
    const input = await screen.findByLabelText("Find your business or address")
    fireEvent.change(input, { target: { value: "ab" } })
    await new Promise((r) => setTimeout(r, 450))
    expect(svc.autocomplete).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: "krishna eye" } })
    const list = await screen.findByTestId("location-suggestions")
    expect(svc.autocomplete).toHaveBeenCalledTimes(1)
    const token = svc.autocomplete.mock.calls[0][1].sessionToken
    expect(token).toMatch(/^[A-Za-z0-9_-]{16,64}$/)
    fireEvent.keyDown(input, { key: "Enter" })
    expect(svc.placeDetails).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Full address")).toHaveValue("")
    fireEvent.click(within(list).getByText("Krishna Eye Centre"))
    await waitFor(() => expect(screen.getByLabelText("Full address")).toHaveValue("12 Gangapur Rd, Nashik 422013, India"))
    expect(svc.placeDetails.mock.calls[0][1]).toEqual({ placeId: "ChIJ_picked-Place1", sessionToken: token })
    expect(screen.getByLabelText("Latitude")).toHaveValue("19.9975")
    expect(screen.getByLabelText("City")).toHaveValue("Nashik")
    expect(screen.getByLabelText("Google Place ID")).toHaveValue("ChIJ_picked-Place1")
    expect(svc.save).not.toHaveBeenCalled()
    expect(screen.getByTestId("location-save")).toBeDisabled()
    expect(screen.getByTestId("location-dirty")).toBeInTheDocument()
  })

  test("save needs the explicit confirmation; then it sends confirmed:true and shows the new state", async () => {
    svc.get.mockResolvedValue({ data: dto() })
    svc.autocomplete.mockResolvedValue({ data: { suggestions: sug } })
    svc.placeDetails.mockResolvedValue({ data: { place: picked } })
    svc.save.mockResolvedValue({ data: confirmedDto() })
    renderIt()
    fireEvent.change(await screen.findByLabelText("Find your business or address"), { target: { value: "krishna eye" } })
    fireEvent.click(within(await screen.findByTestId("location-suggestions")).getByText("Krishna Eye Centre"))
    await waitFor(() => expect(screen.getByLabelText("City")).toHaveValue("Nashik"))
    fireEvent.click(screen.getByTestId("location-confirm"))
    expect(screen.getByTestId("location-save")).toBeEnabled()
    fireEvent.click(screen.getByTestId("location-save"))
    await waitFor(() => expect(svc.save).toHaveBeenCalledTimes(1))
    expect(svc.save.mock.calls[0][1].location).toMatchObject({ confirmed: true, placeId: "ChIJ_picked-Place1", lat: 19.9975, lng: 73.7898, countryCode: "IN", coordinatesAdjusted: false })
    await waitFor(() => expect(screen.getByTestId("verification-status")).toHaveTextContent("Location confirmed by you"))
    expect(screen.getByTestId("gbp-status")).toHaveTextContent("Not connected")
    expect(screen.queryByTestId("location-dirty")).not.toBeInTheDocument()
  })

  test("editing anything after ticking the confirmation clears it", async () => {
    svc.get.mockResolvedValue({ data: confirmedDto() })
    renderIt()
    await screen.findByTestId("business-location-card")
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Pune" } })
    const box = screen.getByTestId("location-confirm")
    fireEvent.click(box)
    expect(box).toBeChecked()
    fireEvent.change(screen.getByLabelText("Postal code"), { target: { value: "411001" } })
    expect(box).not.toBeChecked()
  })

  test("invalid coordinates show a message and block saving", async () => {
    svc.get.mockResolvedValue({ data: confirmedDto() })
    renderIt()
    await screen.findByTestId("business-location-card")
    const lat = screen.getByLabelText("Latitude")
    fireEvent.change(lat, { target: { value: "123" } }); fireEvent.blur(lat)
    expect(await screen.findByText("Latitude must be between -90 and 90.")).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("location-confirm"))
    expect(screen.getByTestId("location-save")).toBeDisabled()
    fireEvent.change(lat, { target: { value: "abc" } }); fireEvent.blur(lat)
    expect(await screen.findByText(/must be a number/)).toBeInTheDocument()
  })

  test("moving the marker with the keyboard changes the coordinates and is reported as an adjustment", async () => {
    svc.get.mockResolvedValue({ data: confirmedDto() })
    svc.save.mockResolvedValue({ data: confirmedDto() })
    renderIt()
    await screen.findByTestId("business-location-card")
    fireEvent.keyDown(screen.getByTestId("location-marker"), { key: "ArrowUp" })
    expect(Number(screen.getByLabelText("Latitude").value)).toBeGreaterThan(19.9975)
    fireEvent.click(screen.getByTestId("location-confirm"))
    fireEvent.click(screen.getByTestId("location-save"))
    await waitFor(() => expect(svc.save).toHaveBeenCalled())
    expect(svc.save.mock.calls[0][1].location.coordinatesAdjusted).toBe(true)
  })

  test("address search failing (no key, quota, billing) is explained and the form still works by hand", async () => {
    svc.get.mockResolvedValue({ data: dto() })
    svc.autocomplete.mockRejectedValue(apiError("Address search is not available right now. You can still enter the address and coordinates yourself.", 503, "PLACES_KEY_INVALID"))
    svc.save.mockResolvedValue({ data: confirmedDto() })
    renderIt()
    fireEvent.change(await screen.findByLabelText("Find your business or address"), { target: { value: "krishna eye" } })
    expect(await screen.findByTestId("location-search-error")).toHaveTextContent("not available right now")
    fireEvent.change(screen.getByLabelText("Full address"), { target: { value: "My street, Nashik" } })
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "19.9" } })
    fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "73.7" } })
    fireEvent.click(screen.getByTestId("location-confirm"))
    fireEvent.click(screen.getByTestId("location-save"))
    await waitFor(() => expect(svc.save).toHaveBeenCalled())
    expect(svc.save.mock.calls[0][1].location).toMatchObject({ placeId: null, lat: 19.9, lng: 73.7, confirmed: true })
  })

  test("no results is said plainly", async () => {
    svc.get.mockResolvedValue({ data: dto() })
    svc.autocomplete.mockResolvedValue({ data: { suggestions: [] } })
    renderIt()
    fireEvent.change(await screen.findByLabelText("Find your business or address"), { target: { value: "zzzzzz" } })
    expect(await screen.findByTestId("location-no-results")).toBeInTheDocument()
  })

  test("a save error from the server is shown and nothing is marked saved", async () => {
    svc.get.mockResolvedValue({ data: confirmedDto() })
    svc.save.mockRejectedValue(apiError("Latitude must be between -90 and 90.", 400))
    renderIt()
    await screen.findByTestId("business-location-card")
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Pune" } })
    fireEvent.click(screen.getByTestId("location-confirm"))
    fireEvent.click(screen.getByTestId("location-save"))
    expect(await screen.findByTestId("location-save-error")).toHaveTextContent("Latitude must be between")
    expect(screen.getByTestId("location-dirty")).toBeInTheDocument()
  })

  test("a saved Google Place ID is shown, but Business Profile stays 'Not connected' until it really is", async () => {
    svc.get.mockResolvedValue({ data: confirmedDto() })
    renderIt()
    await screen.findByTestId("business-verification-card")
    expect(screen.getByTestId("gbp-status")).toHaveTextContent("Not connected")
    expect(screen.getByTestId("business-verification-card")).toHaveTextContent("ChIJ_valid-Place123")
    cleanup()
    svc.get.mockResolvedValue({ data: { ...confirmedDto(), verification: { ...confirmedDto().verification, googleBusinessProfileConnected: true } } })
    renderIt()
    await waitFor(() => expect(screen.getByTestId("gbp-status")).toHaveTextContent("Connected"))
  })

  test("identity: saving sends only the identity, with services added by Enter", async () => {
    svc.get.mockResolvedValue({ data: dto() })
    svc.save.mockResolvedValue({ data: dto() })
    renderIt()
    const services = await screen.findByRole("textbox", { name: "Services" })
    fireEvent.change(services, { target: { value: "LASIK" } })
    fireEvent.keyDown(services, { key: "Enter" })
    expect(screen.getByRole("list", { name: "Services" })).toHaveTextContent("LASIK")
    fireEvent.click(screen.getByTestId("identity-save"))
    await waitFor(() => expect(svc.save).toHaveBeenCalled())
    const body = svc.save.mock.calls[0][1]
    expect(body.location).toBeUndefined()
    expect(body.identity).toMatchObject({ businessName: "Krishna Eye Centre", industry: "healthcare", services: ["Cataract", "LASIK"] })
  })

  test("unsaved edits warn on reload", async () => {
    svc.get.mockResolvedValue({ data: confirmedDto() })
    renderIt()
    await screen.findByTestId("business-location-card")
    const clean = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(clean)
    expect(clean.defaultPrevented).toBe(false)
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Pune" } })
    const dirty = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(dirty)
    expect(dirty.defaultPrevented).toBe(true)
  })

  test("a marker that is not a saved, confirmed location says so; a confirmed one says so too", async () => {
    svc.get.mockResolvedValue({ data: dto({ location: confirmedDto().location, verification: { ...dto().verification, status: "unconfirmed", source: "google_places" } }) })
    renderIt()
    await screen.findByTestId("business-location-card")
    expect(screen.getByTestId("marker-label")).toHaveTextContent("Unconfirmed position")
    cleanup()
    svc.get.mockResolvedValue({ data: confirmedDto() })
    renderIt()
    await screen.findByTestId("business-location-card")
    expect(screen.getByTestId("marker-label")).toHaveTextContent("Confirmed location")
    fireEvent.keyDown(screen.getByTestId("location-marker"), { key: "ArrowUp" })
    expect(screen.getByTestId("marker-label")).toHaveTextContent("Unconfirmed position")
  })

  test("no marker at all until there is a position (no default pin)", async () => {
    svc.get.mockResolvedValue({ data: dto() })
    renderIt()
    await screen.findByTestId("business-location-card")
    expect(screen.queryByTestId("location-marker")).not.toBeInTheDocument()
  })
})
