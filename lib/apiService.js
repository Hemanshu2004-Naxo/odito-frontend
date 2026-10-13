import API_BASE_URL from "@/lib/apiConfig";

class ApiService {

  constructor() {

    this.baseURL = API_BASE_URL;

  }


  // Helper method to handle API responses

  async handleResponse(response) {

    const data = await response.json();

    if (!response.ok) {

      // .code/.details are preserved (not just .message) so callers can
      // branch on a specific backend error code — e.g. onboarding's
      // INSUFFICIENT_CREDITS check — instead of string-matching a message.
      // .status is ALSO preserved (F4-001) — some endpoints (e.g.
      // start-url-verification) don't set a .code field on their error
      // responses, so the HTTP status is the only reliable way for a caller
      // to distinguish e.g. 403 (forbidden) from 409 (already running).
      const error = new Error(data.message || 'Something went wrong');
      error.code = data.code;
      error.details = data.details;
      error.status = response.status;
      // Some endpoints return a structured `data` payload alongside an error
      // response (e.g. the AI campaign generator returns
      // { success:false, code, data:{ draftId, status } } when generation
      // failed but a draft was still persisted). Preserved here — like
      // .code/.details above — so callers can recover it; every existing
      // caller simply ignores this field.
      if (data.data !== undefined) error.data = data.data;
      if (Array.isArray(data.errors)) error.errors = data.errors;
      throw error;

    }



    // Return the response as-is — callers are responsible for reading their own shape
    if (data.success) {
      return data;
    }



    return data;

  }



  // Generic request method with authentication

  async request(endpoint, options = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const config = {

      headers: {

        'Content-Type': 'application/json',

        ...(token && { Authorization: `Bearer ${token}` }),

        ...options.headers,

      },

      ...options,

    };



    const response = await fetch(`${this.baseURL}${endpoint}`, config);

    return this.handleResponse(response);

  }



  // Generic POST method for axios-like compatibility

  async post(endpoint, data = {}) {

    return this.request(endpoint, {

      method: 'POST',

      body: JSON.stringify(data)

    });

  }



  // Generic GET method for axios-like compatibility

  async get(endpoint) {

    return this.request(endpoint, {

      method: 'GET'

    });

  }



  // Authentication endpoints

  async register(userData) {

    return this.request('/auth/register', {

      method: 'POST',

      body: JSON.stringify(userData),

    });

  }



  async login(email, password, rememberMe = false) {

    return this.request('/auth/login', {

      method: 'POST',

      body: JSON.stringify({ email, password, rememberMe }),

    });

  }



  async logout() {

    return this.request('/auth/logout', {

      method: 'POST',

    });

  }



  async getProfile() {

    return this.request('/auth/profile');

  }



  async updateProfile(payload) {

    return this.request('/auth/profile', {

      method: 'PUT',

      body: JSON.stringify(payload),

    });

  }



  async changePassword(payload) {

    return this.request('/auth/change-password', {

      method: 'POST',

      body: JSON.stringify(payload),

    });

  }



  // Uses XMLHttpRequest instead of this.request()/fetch — fetch has no

  // upload-progress event, and this.request() always sets

  // 'Content-Type: application/json', which would break a multipart

  // FormData body (the browser must set that header itself, boundary

  // included). onProgress(percent) is optional.

  uploadAvatar(file, onProgress) {

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const formData = new FormData();

    formData.append('avatar', file);



    return new Promise((resolve, reject) => {

      const xhr = new XMLHttpRequest();

      xhr.open('POST', `${this.baseURL}/auth/avatar`);

      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);



      xhr.upload.onprogress = (e) => {

        if (onProgress && e.lengthComputable) {

          onProgress(Math.round((e.loaded / e.total) * 100));

        }

      };



      xhr.onload = () => {

        let data;

        try {

          data = JSON.parse(xhr.responseText);

        } catch {

          data = {};

        }

        if (xhr.status >= 200 && xhr.status < 300) {

          resolve(data);

        } else {

          const error = new Error(data.message || 'Failed to upload avatar');

          error.code = data.code;

          reject(error);

        }

      };



      xhr.onerror = () => reject(new Error('Network error while uploading avatar.'));



      xhr.send(formData);

    });

  }



  async removeAvatar() {

    return this.request('/auth/avatar', {

      method: 'DELETE',

    });

  }



  async requestAccountDeletion() {

    return this.request('/auth/account/delete/request', {

      method: 'POST',

    });

  }



  async verifyAccountDeletion(payload) {

    return this.request('/auth/account/delete/verify', {

      method: 'POST',

      body: JSON.stringify(payload),

    });

  }



  async deleteAccount(deletionToken) {

    return this.request('/auth/account', {

      method: 'DELETE',

      body: JSON.stringify({ deletionToken }),

    });

  }



  async getSubscription() {

    return this.request('/subscription');

  }



  async getPlans() {

    return this.request('/plans');

  }



  async createCheckoutSession(plan) {

    return this.request('/subscription/checkout', {

      method: 'POST',

      body: JSON.stringify({ plan }),

    });

  }



  async createBillingPortalSession() {

    return this.request('/subscription/portal', {

      method: 'POST',

    });

  }



  async changePlan(plan) {

    return this.request('/subscription/change-plan', {

      method: 'POST',

      body: JSON.stringify({ plan }),

    });

  }



  async submitCustomPlanRequest(payload) {

    return this.request('/subscription/custom-request', {

      method: 'POST',

      body: JSON.stringify(payload),

    });

  }



  async getMyCustomPlanRequest() {

    return this.request('/subscription/custom-request/me');

  }



  async createPagePurchaseCheckout({ pages, projectId, returnPath }) {

    return this.request('/page-purchases/checkout', {

      method: 'POST',

      body: JSON.stringify({ pages, projectId, returnPath }),

    });

  }



  async createCreditPurchaseCheckout({ credits, returnPath }) {

    return this.request('/credit-purchases/checkout', {

      method: 'POST',

      body: JSON.stringify({ credits, returnPath }),

    });

  }



  async getBillingHistory(page = 1, limit = 20) {

    return this.request(`/subscription/history?page=${page}&limit=${limit}`);

  }



  async getSystemAdminDashboard() {

    return this.request('/system-admin/dashboard');

  }



  async getSystemAdminUsers(params = {}) {

    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {

      if (value !== undefined && value !== null && value !== '') {

        query.set(key, value);

      }

    });

    const qs = query.toString();

    return this.request(`/system-admin/users${qs ? `?${qs}` : ''}`);

  }



  async getSystemAdminUserDetail(userId) {

    return this.request(`/system-admin/users/${userId}`);

  }



  async suspendSystemAdminUser(userId, reason) {

    return this.request(`/system-admin/users/${userId}/suspend`, {

      method: 'POST',

      body: JSON.stringify({ reason }),

    });

  }



  async activateSystemAdminUser(userId, reason) {

    return this.request(`/system-admin/users/${userId}/activate`, {

      method: 'POST',

      body: JSON.stringify({ reason }),

    });

  }



  async getSystemAdminSubscriptions(params = {}) {

    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {

      if (value !== undefined && value !== null && value !== '') {

        query.set(key, value);

      }

    });

    const qs = query.toString();

    return this.request(`/system-admin/subscriptions${qs ? `?${qs}` : ''}`);

  }



  async getSystemAdminSubscriptionDetail(userId) {

    return this.request(`/system-admin/subscriptions/${userId}`);

  }



  // The three calls below hit the EXISTING admin subscription-override

  // routes (subscriptionRoutes.js -> adminSubscriptionController.js),

  // reused as-is per Phase 2D's "do not duplicate admin actions" — this is

  // the first frontend code to ever call them, not a new backend endpoint.

  async adminAssignPlan(userId, planId, reason) {

    return this.request(`/subscription/admin/users/${userId}/plan`, {

      method: 'POST',

      body: JSON.stringify({ planId, reason }),

    });

  }



  async adminAdjustQuota(userId, { credits, pages } = {}, reason) {

    return this.request(`/subscription/admin/users/${userId}/quota`, {

      method: 'POST',

      body: JSON.stringify({ credits, pages, reason }),

    });

  }



  async adminUpdateSubscriptionStatus(userId, status, reason) {

    return this.request(`/subscription/admin/users/${userId}/status`, {

      method: 'POST',

      body: JSON.stringify({ status, reason }),

    });

  }



  async getSystemAdminCustomPlanRequests(params = {}) {

    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {

      if (value !== undefined && value !== null && value !== '') {

        query.set(key, value);

      }

    });

    const qs = query.toString();

    return this.request(`/system-admin/custom-plan-requests${qs ? `?${qs}` : ''}`);

  }



  async getSystemAdminCustomPlanRequestDetail(id) {

    return this.request(`/system-admin/custom-plan-requests/${id}`);

  }



  // Writes go through the subscription module's own admin routes (not
  // system-admin) — matching the existing adminAssignPlan/adminAdjustQuota/
  // adminUpdateSubscriptionStatus split above.

  async adminUpdateCustomPlanRequestStatus(id, status) {

    return this.request(`/subscription/admin/custom-plan-requests/${id}/status`, {

      method: 'POST',

      body: JSON.stringify({ status }),

    });

  }



  async adminAddCustomPlanRequestNote(id, note) {

    return this.request(`/subscription/admin/custom-plan-requests/${id}/notes`, {

      method: 'POST',

      body: JSON.stringify({ note }),

    });

  }



  async getSystemAdminPayments(params = {}) {

    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {

      if (value !== undefined && value !== null && value !== '') {

        query.set(key, value);

      }

    });

    const qs = query.toString();

    return this.request(`/system-admin/payments${qs ? `?${qs}` : ''}`);

  }



  async getSystemAdminPaymentsSummary() {

    return this.request('/system-admin/payments/summary');

  }



  async getSystemAdminPaymentDetail(paymentId) {

    return this.request(`/system-admin/payments/${encodeURIComponent(paymentId)}`);

  }



  async getSystemAdminJobs(params = {}) {

    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {

      if (value !== undefined && value !== null && value !== '') {

        query.set(key, value);

      }

    });

    const qs = query.toString();

    return this.request(`/system-admin/jobs${qs ? `?${qs}` : ''}`);

  }



  async getSystemAdminJobsSummary() {

    return this.request('/system-admin/jobs/summary');

  }



  async getSystemAdminJobDetail(jobId) {

    return this.request(`/system-admin/jobs/${jobId}`);

  }



  async getSystemAdminWebhooks(params = {}) {

    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {

      if (value !== undefined && value !== null && value !== '') {

        query.set(key, value);

      }

    });

    const qs = query.toString();

    return this.request(`/system-admin/webhooks${qs ? `?${qs}` : ''}`);

  }



  async getSystemAdminWebhooksSummary() {

    return this.request('/system-admin/webhooks/summary');

  }



  async getSystemAdminWebhookDetail(id) {

    return this.request(`/system-admin/webhooks/${id}`);

  }



  async getSystemAdminAuditLogs(params = {}) {

    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {

      if (value !== undefined && value !== null && value !== '') {

        query.set(key, value);

      }

    });

    const qs = query.toString();

    return this.request(`/system-admin/audit-logs${qs ? `?${qs}` : ''}`);

  }



  async getSystemAdminAuditLogsSummary() {

    return this.request('/system-admin/audit-logs/summary');

  }



  async getSystemAdminAuditLogDetail(id) {

    return this.request(`/system-admin/audit-logs/${id}`);

  }



  // ODITO-OPS-001: Verification Operations Dashboard — read-only, same
  // URLSearchParams-filter pattern every other System Admin list method
  // above already uses.

  async getSystemAdminVerificationBatches(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, value);
      }
    });
    const qs = query.toString();
    return this.request(`/system-admin/verification/batches${qs ? `?${qs}` : ''}`);
  }

  async getSystemAdminVerificationBatchesSummary() {
    return this.request('/system-admin/verification/batches/summary');
  }

  async getSystemAdminVerificationBatchDetail(batchId) {
    return this.request(`/system-admin/verification/batches/${batchId}`);
  }

  async getSystemAdminVerificationQueueSummary() {
    return this.request('/system-admin/verification/queue/summary');
  }

  async getSystemAdminVerificationRecoveryEvents(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, value);
      }
    });
    const qs = query.toString();
    return this.request(`/system-admin/verification/recovery${qs ? `?${qs}` : ''}`);
  }

  async getSystemAdminVerificationRecoverySummary() {
    return this.request('/system-admin/verification/recovery/summary');
  }

  async getSystemAdminVerificationWorkerHealth() {
    return this.request('/system-admin/verification/workers');
  }



  async getSystemAdminProjects(params = {}) {

    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {

      if (value !== undefined && value !== null && value !== '') {

        query.set(key, value);

      }

    });

    const qs = query.toString();

    return this.request(`/system-admin/projects${qs ? `?${qs}` : ''}`);

  }



  async getSystemAdminProjectsSummary() {

    return this.request('/system-admin/projects/summary');

  }



  async getSystemAdminProjectDetail(id) {

    return this.request(`/system-admin/projects/${id}`);

  }



  async startSystemAdminProjectAudit(id, reason) {

    return this.request(`/system-admin/projects/${id}/start-audit`, {

      method: 'POST',

      body: JSON.stringify({ reason }),

    });

  }



  async deleteSystemAdminProject(id, reason) {

    return this.request(`/system-admin/projects/${id}`, {

      method: 'DELETE',

      body: JSON.stringify({ reason }),

    });

  }



  async restoreSystemAdminProject(id, reason) {

    return this.request(`/system-admin/projects/${id}/restore`, {

      method: 'POST',

      body: JSON.stringify({ reason }),

    });

  }



  async permanentlyDeleteSystemAdminProject(id, reason) {

    return this.request(`/system-admin/projects/${id}/permanent`, {

      method: 'DELETE',

      body: JSON.stringify({ reason }),

    });

  }



  async verifyEmailOTP(email, otp) {

    return this.request('/auth/verify-email-otp', {

      method: 'POST',

      body: JSON.stringify({ email, otp }),

    });

  }



  async generateEmailOTP(email) {

    return this.request('/auth/generate-email-otp', {

      method: 'POST',

      body: JSON.stringify({ email }),

    });

  }



  async resendVerificationEmail(email) {

    return this.request('/auth/resend-verification', {

      method: 'POST',

      body: JSON.stringify({ email }),

    });

  }



  async forgotPassword(email) {

    return this.request('/auth/forgot-password', {

      method: 'POST',

      body: JSON.stringify({ email }),

    });

  }



  // Step 2 of the reset flow — verifies the OTP and returns a short-lived
  // resetToken. This is the ONLY thing that authorizes step 3; the OTP
  // itself is never sent to /reset-password.

  async verifyResetOtp(email, otp) {

    return this.request('/auth/verify-reset-otp', {

      method: 'POST',

      body: JSON.stringify({ email, otp }),

    });

  }



  // Step 3a — read-only, safe to call on every reset-password page
  // load/refresh. Never sent an email — only the opaque token.

  async validateResetToken(token) {

    return this.request(`/auth/validate-reset-token?token=${encodeURIComponent(token)}`);

  }



  // Step 3b — token + new password only. confirmPassword is still sent so
  // the backend can independently verify the match (never trust the
  // frontend's own check).

  async resetPassword(token, newPassword, confirmPassword) {

    return this.request('/auth/reset-password', {

      method: 'POST',

      body: JSON.stringify({ token, newPassword, confirmPassword }),

    });

  }



  // Project endpoints

  async getProjects(page = 1, limit = 10) {

    return this.request(`/app_user/projects?page=${page}&limit=${limit}`);

  }



  async getProjectById(projectId) {

    const endpoint = `/app_user/projects/${projectId}`;

    return this.request(endpoint);

  }



  async createProject(projectData) {

    return this.request('/app_user/projects', {

      method: 'POST',

      body: JSON.stringify(projectData)

    });

  }



  async updateProject(projectId, projectData) {

    return this.request(`/app_user/projects/${projectId}`, {

      method: 'PUT',

      body: JSON.stringify(projectData)

    });

  }



  async deleteProject(projectId) {

    return this.request(`/app_user/projects/${projectId}`, {

      method: 'DELETE'

    });

  }



  // Project Trash & Restore

  async getTrashedProjects(page = 1, limit = 10) {

    return this.request(`/app_user/projects/trash?page=${page}&limit=${limit}`);

  }



  async restoreProject(projectId) {

    return this.request(`/app_user/projects/trash/${projectId}/restore`, {

      method: 'POST'

    });

  }



  async permanentlyDeleteProject(projectId) {

    return this.request(`/app_user/projects/trash/${projectId}/permanent`, {

      method: 'DELETE'

    });

  }



  // Audit endpoints

  async startAudit(projectId) {

    const endpoint = '/seo/start-scraping';

    const payload = { project_id: projectId };

    console.log('🚀 Starting audit request:', { endpoint, payload });



    try {

      const response = await this.request(endpoint, {

        method: 'POST',

        body: JSON.stringify(payload)

      });

      console.log('✅ Audit start response:', response);

      return response;

    } catch (error) {

      console.error('❌ Audit start error:', error);

      throw error;

    }

  }



  async startVerification(projectId) {

    const endpoint = '/seo/start-verification';

    const payload = { project_id: projectId };

    console.log('⚡ Starting Quick Recheck request:', { endpoint, payload });

    try {

      const response = await this.request(endpoint, {

        method: 'POST',

        body: JSON.stringify(payload)

      });

      console.log('✅ Quick Recheck start response:', response);

      return response;

    } catch (error) {

      console.error('❌ Quick Recheck start error:', error);

      throw error;

    }

  }



  async getAuditStatus(projectId) {

    return this.request(`/seo/scraping-status/${projectId}`);

  }



  // F4-001: single-page URL Verification — distinct from startVerification
  // above (legacy, project-wide Quick Recheck). Hits the URL Verification
  // Engine's own endpoint (backend Phase 3 / hardening work), which takes a
  // specific page URL rather than operating on the whole project.
  async verifyUrl(projectId, url) {

    const endpoint = '/seo/start-url-verification';

    const payload = { projectId, url };

    console.log('🔎 Starting URL verification request:', { endpoint, payload });

    try {

      const response = await this.request(endpoint, {

        method: 'POST',

        body: JSON.stringify(payload)

      });

      console.log('✅ URL verification start response:', response);

      return response;

    } catch (error) {

      console.error('❌ URL verification start error:', error);

      throw error;

    }

  }



  // F4-019: Verification Batch — one request starts every selected URL's
  // pipeline (backend-orchestrated), replacing N individual verifyUrl()
  // calls when NEXT_PUBLIC_ENABLE_BATCH_VERIFICATION is on. Response shape
  // is flat (no `data` wrapper) per this endpoint's own contract, matching
  // the backend controller's documented behavior — unlike most other
  // endpoints here, do not read `.data` off the resolved value.
  async startVerificationBatch(projectId, urls) {
    return this.request('/seo/start-verification-batch', {
      method: 'POST',
      body: JSON.stringify({ projectId, urls }),
    });
  }

  // F4-019: read-only Verification Batch status — used for recovery after a
  // websocket reconnect or a full browser reload, never for polling.
  async getVerificationBatch(batchId) {
    return this.request(`/seo/verification-batches/${batchId}`);
  }

  // F4-019: every PageVerificationRun belonging to a batch — same recovery
  // use as getVerificationBatch above.
  async getVerificationBatchRuns(batchId) {
    return this.request(`/seo/verification-batches/${batchId}/runs`);
  }

  // F4-002: latest URL Verification result for this page, used by the
  // in-page result panel. Hits the existing (frozen) verification history
  // endpoint — no new backend route.
  async getLatestVerification(projectId, url) {
    const encodedUrl = encodeURIComponent(url);
    return this.request(`/seo/projects/${projectId}/pages/${encodedUrl}/latest-verification`);
  }

  // F4-003: project-wide URL Verification history (frozen backend has no
  // page-scoped list route — only a project-wide one and a page-scoped
  // "latest" one). useVerificationHistory filters this down to one page
  // client-side. limit defaults to the endpoint's own max (50); no
  // pagination UI is implemented yet, so only this first page is consumed.
  async getVerificationHistory(projectId, { limit = 50 } = {}) {
    return this.request(`/seo/projects/${projectId}/verification-history?limit=${limit}`);
  }

  // F4-004: single verification run by id, for the Run Detail Drawer.
  // Deliberately NOT the latest-verification endpoint — this always fetches
  // the exact run the user clicked in history, not "whatever is newest".
  async getVerificationRun(runId) {
    return this.request(`/seo/verification-runs/${runId}`);
  }



  async cancelAudit(projectId, jobId) {

    return this.request('/seo/cancel-audit', {

      method: 'POST',

      body: JSON.stringify({ project_id: projectId, job_id: jobId })

    });

  }



  // AI Visibility endpoints

  async startAiVisibility(projectId) {

    const endpoint = '/ai-visibility/start';

    const payload = { project_id: projectId };

    console.log('🚀 Starting AI Visibility request:', { endpoint, payload });



    try {

      const response = await this.request(endpoint, {

        method: 'POST',

        body: JSON.stringify(payload)

      });

      console.log('✅ AI Visibility start response:', response);

      return response;

    } catch (error) {

      console.error('❌ AI Visibility start error:', error);

      throw error;

    }

  }



  // Get AI visibility entity graph

  async getAIVisibilityEntityGraph(projectId) {

    const endpoint = `/app_user/projects/${projectId}/ai-visibility/entity-graph`;

    console.log('🔍 Getting AI visibility entity graph:', { endpoint, projectId });



    try {

      const response = await this.request(endpoint);

      console.log('✅ AI visibility entity graph response:', response);

      return response;

    } catch (error) {

      console.error('❌ AI visibility entity graph error:', error);

      throw error;

    }

  }



  // Get AI Search Audit metrics

  async getAISearchAudit(projectId) {

    const endpoint = `/ai-visibility/projects/${projectId}/ai-search-audit`;

    try {
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      throw error;

    }

  }



  // Get AI Search Audit issue details

  async getAISearchAuditIssue(projectId, issueId) {

    const endpoint = `/ai-visibility/projects/${projectId}/ai-search-audit/issues/${issueId}`;

    try {
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      throw error;

    }

  }



  // Get AI Search Audit issues list

  async getAISearchAuditIssues(projectId) {

    const endpoint = `/ai-visibility/projects/${projectId}/ai-search-audit/issues`;

    try {
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      throw error;

    }

  }



  // Get AI Search Audit issue affected pages

  async getAISearchAuditIssuePages(projectId, issueId, options = {}) {

    const { page = 1, limit = 50 } = options;

    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });

    const endpoint = `/ai-visibility/projects/${projectId}/ai-search-audit/issues/${issueId}/affected-pages?${params}`;

    try {
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      throw error;

    }

  }



  // ── AEO Hub V2 ────────────────────────────────────────────────────────────

  async getAEOHubData(projectId) {
    return this.request(`/aeo-hub/${projectId}`);
  }

  async getAEOHubIssues(projectId) {
    return this.request(`/aeo-hub/${projectId}/issues`);
  }

  async getAEOHubIssueDetail(projectId, ruleId) {
    return this.request(`/aeo-hub/${projectId}/issues/${encodeURIComponent(ruleId)}`);
  }

  // ── AI Pages (URL-level AI issue detail) ─────────────────────────────────

  async getPageAIIssues(projectId, url) {
    return this.request(`/ai-pages/${projectId}/issues?url=${encodeURIComponent(url)}`);
  }

  // ── GEO Hub V2 ────────────────────────────────────────────────────────────

  async getGEOHubData(projectId) {
    return this.request(`/geo-hub/${projectId}`);
  }

  async getGEOHubIssues(projectId) {
    return this.request(`/geo-hub/${projectId}/issues`);
  }

  async getGEOHubIssueDetail(projectId, ruleId) {
    return this.request(`/geo-hub/${projectId}/issues/${encodeURIComponent(ruleId)}`);
  }

  // Get AI visibility page details

  async getAIVisibilityPage(projectId, url) {

    const encodedUrl = encodeURIComponent(url);

    const endpoint = `/app_user/projects/${projectId}/ai-visibility/page?url=${encodedUrl}`;



    console.log('🔍 Getting AI visibility page details:', { endpoint, projectId, url });



    try {

      const response = await this.request(endpoint);

      console.log('✅ AI visibility page response:', response);

      return response;

    } catch (error) {

      console.error('❌ AI visibility page error:', error);

      throw error;

    }

  }



  // Get AI visibility pages with pagination and filters

  async getAIVisibilityPages(projectId, params = {}) {

    const queryString = new URLSearchParams(params).toString();

    const endpoint = queryString

      ? `/app_user/projects/${projectId}/ai-visibility/pages?${queryString}`

      : `/app_user/projects/${projectId}/ai-visibility/pages`;



    console.log('🔍 Getting AI visibility pages:', { endpoint, projectId, params });



    try {

      const response = await this.request(endpoint);

      console.log('✅ AI visibility pages response:', response);

      return response;

    } catch (error) {

      console.error('❌ AI visibility pages error:', error);

      throw error;

    }

  }



  // Get AI visibility worst pages

  async getAIVisibilityWorstPages(projectId, limit = 5) {

    const endpoint = `/app_user/projects/${projectId}/ai-visibility/worst-pages?limit=${limit}`;

    console.log('🔍 Getting AI visibility worst pages:', { endpoint, projectId, limit });



    try {

      const response = await this.request(endpoint);

      console.log('✅ AI visibility worst pages response:', response);

      return response;

    } catch (error) {

      console.error('❌ AI visibility worst pages error:', error);

      throw error;

    }

  }



  // Project issues endpoints

  async getProjectIssues(projectId, filters = {}) {

    const { category, severity, search } = filters;

    const params = new URLSearchParams();



    if (category) params.append('category', category);

    if (severity) params.append('severity', severity);

    if (search) params.append('search', search);



    const queryString = params.toString();

    const endpoint = `/app_user/projects/${projectId}/issues${queryString ? '?' + queryString : ''}`;

    return this.request(endpoint);

  }



  // Project subpages endpoints

  async getProjectSubpages(projectId, filters = {}) {

    const { filter, search, sortBy, sortOrder, page = 1, limit = 50 } = filters;

    const params = new URLSearchParams();



    if (filter) params.append('filter', filter);

    if (search) params.append('search', search);

    if (sortBy) params.append('sortBy', sortBy);

    if (sortOrder) params.append('sortOrder', sortOrder);

    if (page) params.append('page', page);

    if (limit) params.append('limit', limit);



    const queryString = params.toString();

    const endpoint = `/app_user/projects/${projectId}/pages${queryString ? '?' + queryString : ''}`;

    return this.request(endpoint);

  }



  // Page issues endpoints

  async getPageIssues(projectId, pageUrl) {

    const params = new URLSearchParams();

    if (pageUrl) params.append('page_url', pageUrl);



    const queryString = params.toString();

    const endpoint = `/app_user/projects/${projectId}/page-issues${queryString ? '?' + queryString : ''}`;

    return this.request(endpoint);

  }



  // Get raw HTML for a page from stored data

  async getPageRawHtml(url, projectId) {

    const encodedUrl = encodeURIComponent(url);

    if (!projectId) {
      throw new Error('projectId is required for getPageRawHtml');
    }

    const endpoint = `/seo/raw-html?url=${encodedUrl}&project_id=${projectId}`;

    try {
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      throw error;

    }

  }



  // On-page issues (aggregated by issue_code)

  async getOnPageIssues(projectId) {

    return this.request(`/app_user/projects/${projectId}/onpage-issues`);

  }



  // Get all URLs for a specific issue

  async getIssueUrls(projectId, issueCode) {

    return this.request(`/app_user/projects/${projectId}/onpage-issues/${issueCode}`);

  }



  // Technical checks endpoints

  async getTechnicalChecks(projectId) {

    const endpoint = `/app_user/projects/${projectId}/technical-checks`;

    try {
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      throw error;
    }

  }



  async getPreAudit(projectId) {
    return this.request(`/app_user/projects/${projectId}/pre-audit`);
  }

  async getUrlPool(projectId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/app_user/projects/${projectId}/url-pool${queryString ? '?' + queryString : ''}`;
    return this.request(endpoint);
  }

  async submitUrlSelection(projectId, selectedUrls) {
    return this.request(`/app_user/projects/${projectId}/url-selection`, {
      method: 'POST',
      body: JSON.stringify({ selectedUrls })
    });
  }

  async updateHomepageAuditSnapshot(auditId, type, data) {
    return this.request(`/homepage-audit/${auditId}`, {
      method: 'PATCH',
      body: JSON.stringify({ type, ...data })
    });
  }

  // NEW: Optimized API for project overview (combines project, performance, technical data)
  async getProjectOverview(projectId) {
    const endpoint = `/app_user/projects/${projectId}/overview`;

    try {
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      throw error;
    }
  }

  // NEW: Lightweight API for issue counts (single collection query)
  async getIssueCounts(projectId) {
    const endpoint = `/app_user/projects/${projectId}/issue-counts`;

    try {
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      throw error;
    }
  }



  async getTechnicalCheckDetail(projectId, checkId) {

    const endpoint = `/app_user/projects/${projectId}/technical-checks/${checkId}`;



    try {

      const response = await this.request(endpoint);

      return response;

    } catch (error) {

      throw error;

    }

  }



  // PageSpeed endpoints

  async getPageSpeedData(projectId) {
    const endpoint = `/app_user/projects/${projectId}/performance`;
    try {
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      throw error;
    }
  }

  async rescanPageSpeed(projectId) {
    const endpoint = `/pagespeed/rescan/${projectId}`;
    try {
      const response = await this.request(endpoint, { method: 'POST' });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async getPageSpeedStatus(projectId) {
    const endpoint = `/pagespeed/status/${projectId}`;
    try {
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      throw error;
    }
  }



  async performPageSpeedAnalysis(url) {
    const endpoint = '/pagespeed/';

    try {
      console.log("📡 Calling /api/pagespeed...");
      console.log("📡 PageSpeed request body:", JSON.stringify({ url: url.trim() }));

      const response = await this.request(endpoint, {
        method: 'POST',
        body: JSON.stringify({ url: url.trim() })
      });

      console.log("📥 PageSpeed response received:", response);
      return response;
    } catch (error) {
      console.error("📡 PageSpeed request failed:", error);
      throw error;
    }
  }

  async performHomepagePageSpeed(url) {
    console.log("⚡ Calling homepage-pagespeed...");

    // Use the same base URL as other API calls
    const endpoint = '/homepage-pagespeed';

    // Create AbortController for 180-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 180 seconds

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: url.trim() }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await this.handleResponse(response);
      console.log("📥 Homepage PageSpeed response received:", data);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        console.error("⚡ Homepage PageSpeed request timed out after 180 seconds");
        throw new Error('PageSpeed analysis timed out after 180 seconds');
      } else {
        console.error("⚡ Homepage PageSpeed request failed:", error);
        throw error;
      }
    }
  }


  // PDF endpoints

  async getPDFPageData(projectId, page) {
    const endpoint = `/pdf/${projectId}/page${page}`;

    try {
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Store authentication token

  setToken(token) {

    if (typeof window !== 'undefined') {

      localStorage.setItem('token', token);

    }

  }



  // Get authentication token

  getToken() {

    if (typeof window !== 'undefined') {

      return localStorage.getItem('token');

    }

    return null;

  }



  // Remove authentication token

  removeToken() {

    if (typeof window !== 'undefined') {

      localStorage.removeItem('token');

    }

  }



  // Check if user is authenticated

  isAuthenticated() {

    return !!this.getToken();

  }



  // Redirect to dashboard (or any specified route)

  redirectToDashboard(router, route = '/dashboard') {

    if (router) {

      router.push(route);

    } else if (typeof window !== 'undefined') {

      window.location.href = route;

    }

  }


  // ═══════════════════════════════════════════════════════════════════════
  //  SEO Onboarding endpoints (keyword generation + ranking)
  // ═══════════════════════════════════════════════════════════════════════

  async generateKeywords(subType, location, country = 'US', language = 'en', lat = null, lng = null, city = null) {
    const endpoint = '/seo/generate-keywords';
    const payload = { subType, location, country, language, lat, lng, city };
    console.log('🔍 Generating keywords:', { endpoint, payload });

    try {
      const response = await this.request(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      console.log('✅ Keywords generated:', response);
      return response;
    } catch (error) {
      console.error('❌ Keyword generation error:', error);
      throw error;
    }
  }

  async checkRanking(domain, keywords, location, country = null, language = 'en', businessLocation = null, seoScope = null, cityName = null, businessName = null) {
    const endpoint = '/seo/check-ranking';
    const payload = {
      domain,
      keywords,
      location,
      country,
      language,
      businessLocation,
      seoScope,
      cityName,
      businessName,
    };

    try {
      const response = await this.request(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async saveRanking(projectId, domain, location, keywords, locationCode = null, country = null, language = 'en', seoScope = null) {
    const endpoint = '/seo/save-ranking';
    const payload = { projectId, domain, location, keywords, locationCode, country, language, seoScope };

    try {
      const response = await this.request(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async getProjectRankings(projectId) {
    const endpoint = `/seo/rankings/${projectId}`;

    try {
      const response = await this.request(endpoint, {
        method: 'GET'
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async rescanKeyword(projectId, keyword) {
    const endpoint = `/seo/keywords/${projectId}/rescan`;

    try {
      const response = await this.request(endpoint, {
        method: 'POST',
        body: JSON.stringify({ keyword })
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async addKeyword(projectId, keyword) {
    const endpoint = `/seo/keywords/${projectId}`;

    try {
      const response = await this.request(endpoint, {
        method: 'POST',
        body: JSON.stringify({ keyword })
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async deleteKeyword(projectId, keyword) {
    const endpoint = `/seo/keywords/${projectId}/${encodeURIComponent(keyword)}`;

    try {
      const response = await this.request(endpoint, {
        method: 'DELETE'
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async getKeywordRankingAnalysis(projectId) {
    const endpoint = `/pdf/${projectId}/page16`;

    try {
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Business search endpoints

  async searchBusiness(businessName, businessLocation) {
    const endpoint = '/app_user/business/search';

    try {

      const response = await this.request(endpoint, {

        method: 'POST',

        body: JSON.stringify({

          businessName: businessName.trim(),

          businessLocation: businessLocation.trim()

        })

      });

      return response;

    } catch (error) {

      // warn, not error: the onboarding chat handles this failure itself (it shows
      // the manual-website fallback), and Next's dev overlay pops a red error
      // screen for every console.error.
      console.warn('Business search failed:', error?.message);

      throw error;

    }

  }

  /**
   * Extract business data from a website URL (manual fallback flow)
   * @param {string} websiteUrl - URL to scrape and extract data from
   * @returns {Promise<Object>} Extracted business data
   */
  async extractFromWebsite(websiteUrl) {
    const endpoint = '/app_user/business/extract-from-website';

    try {
      console.log('🌐 Extracting business data from website:', websiteUrl);

      const response = await this.request(endpoint, {
        method: 'POST',
        body: JSON.stringify({ url: websiteUrl.trim() })
      });

      console.log('✅ Website extraction response:', response);
      return response;
    } catch (error) {
      // warn: handled by the onboarding chat ("Continue without analysis"); see searchBusiness.
      console.warn('Website extraction failed:', error?.message);
      throw error;
    }
  }

  /**
   * Resolve city/country from extracted website metadata (Local SEO fallback).
   * Called when Google Places failed and user selected Local SEO — before asking
   * the user for a city we first try to auto-detect it from website data.
   *
   * @param {{ address?: string, extractedMetadata?: object }} params
   * @returns {Promise<{ success: boolean, data: { city, country, locationCode, source, confidence }|null }>}
   */
  async resolveWebsiteLocation({ address = null, extractedMetadata = null } = {}) {
    return this.post('/seo/resolve-website-location', { address, extractedMetadata });
  }

  async getBusinessDetails(placeId) {

    const endpoint = `/app_user/business/details/${placeId}`;

    console.log('🔍 Getting business details:', { endpoint, placeId });



    try {

      const response = await this.request(endpoint);

      console.log('✅ Business details response:', response);

      return response;

    } catch (error) {

      console.error('❌ Business details error:', error);

      throw error;

    }

  }

  async checkBusinessHealth() {

    const endpoint = '/app_user/business/health';

    console.log('🔍 Checking business service health:', { endpoint });



    try {

      const response = await this.request(endpoint);

      console.log('✅ Business health response:', response);

      return response;

    } catch (error) {

      console.error('❌ Business health error:', error);

      throw error;

    }

  }

  // Accessibility issues endpoints

  async getAccessibilityIssues(filters = {}) {

    const { projectId, seo_jobId, severity } = filters;

    const params = new URLSearchParams();

    if (projectId) params.append('projectId', projectId);

    if (seo_jobId) params.append('seo_jobId', seo_jobId);

    if (severity) params.append('severity', severity);

    const queryString = params.toString();

    const endpoint = `/accessibility/issues${queryString ? '?' + queryString : ''}`;

    try {
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      throw error;

    }

  }

  // Lightweight business discovery from URL (runs before audit starts)
  async discoverBusiness(url) {
    return this.request('/external/discover-business', {
      method: 'POST',
      body: JSON.stringify({ url: url.trim() })
    });
  }

  // Search-as-you-type: return up to 4 Google Places candidates. location is optional.
  // Rejects (with .status/.code from the backend) when the search itself fails -
  // callers must not treat a rejection as "no results". Pass `signal` to cancel.
  async searchBusinessCandidates(query, location = '', { signal } = {}) {
    return this.request('/external/search-businesses', {
      method: 'POST',
      body: JSON.stringify({ query: query.trim(), location: location.trim() }),
      ...(signal && { signal })
    });
  }

  // Local SEO Presence (Google Places) endpoint

  async searchLocalPresence(businessName, location, scrapedData = {}) {
    const endpoint = '/external/local-seo';

    try {
      const response = await this.request(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          businessName: businessName.trim(),
          location: location.trim(),
          scrapedData
        })
      });
      return response;
    } catch (error) {
      console.error('Local SEO search error:', error);
      throw error;
    }
  }

  // ── Issue Context Engine ────────────────────────────────────────────────

  /**
   * Resolve IssueContext for a specific issue + page.
   * Returns the full context object with currentState, expectedState, pageContext.
   */
  async getIssueContext(projectId, issueId, pageUrl) {
    const encodedUrl = encodeURIComponent(pageUrl);
    return this.request(`/issue-context/${projectId}/${issueId}?pageUrl=${encodedUrl}`);
  }

  /**
   * Batch resolve IssueContext for multiple pages of the same issue.
   */
  async batchIssueContext(projectId, issueId, pageUrls, concurrency = 10) {
    return this.request('/issue-context/batch', {
      method: 'POST',
      body: JSON.stringify({ projectId, issueId, pageUrls, concurrency }),
    });
  }

  async performHomepageAudit(url) {
    const endpoint = '/homepage-audit';

    try {
      console.log("🌐 ApiService: Making request to", `${this.baseURL}${endpoint}`);
      console.log("🌐 ApiService: Request body:", JSON.stringify({ url: url.trim() }));

      const response = await this.request(endpoint, {
        method: 'POST',
        body: JSON.stringify({ url: url.trim() })
      });

      console.log("🌐 ApiService: Response received:", response);
      return response;
    } catch (error) {
      console.error("🌐 ApiService: Request failed:", error);
      throw error;
    }
  }

  async performAccessibilityAudit(url) {
    const endpoint = '/accessibility/fast-audit';

    try {
      console.log("♿ ApiService: Making accessibility request to", `${this.baseURL}${endpoint}`);
      console.log("♿ ApiService: Request body:", JSON.stringify({ url: url.trim() }));

      const response = await this.request(endpoint, {
        method: 'POST',
        body: JSON.stringify({ url: url.trim() })
      });

      console.log("♿ ApiService: Accessibility response received:", response);
      return response;
    } catch (error) {
      console.error("♿ ApiService: Accessibility request failed:", error);
      throw error;
    }
  }

  // ── Homepage Audit Video ────────────────────────────────────────────────
  // Public endpoints — no auth required. These live under /external/ routes.

  async generateHomepageAuditVideo(auditId) {
    return this.request('/external/homepage-audit-video', {
      method: 'POST',
      body: JSON.stringify({ auditId }),
    });
  }

  async getHomepageAuditVideoStatus(auditId) {
    return this.request(`/external/homepage-audit-video/${auditId}`);
  }

  // ── Homepage Audit PDF ──────────────────────────────────────────────────
  // Public endpoint — no auth required, same opaque-ObjectId pattern as the
  // rest of the Homepage Audit API. Returns the PDF data contract only;
  // actual PDF generation happens client-side (see pdfGeneratorService.js).

  async getHomepageAuditPdfData(auditId) {
    return this.request(`/homepage-audit-pdf/${auditId}/data`);
  }

  async generateHomepageAuditPdf(auditId) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`${this.baseURL}/homepage-audit-pdf/${auditId}/generate`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      let msg = 'Failed to generate PDF';
      try {
        const errJson = await response.json();
        msg = errJson.message || msg;
      } catch (_) {}
      throw new Error(msg);
    }

    return response.blob();
  }

  async getAIAccessibility(projectId) {
    return this.request(`/ai-visibility/projects/${projectId}/ai-accessibility`);
  }

  // ── Fix Logs ──────────────────────────────────────────────────────────────

  async markFixed(data) {
    return this.request('/fix-logs/fix', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async reopenFixLog(fixLogId) {
    return this.request('/fix-logs/reopen', {
      method: 'POST',
      body: JSON.stringify({ fixLogId }),
    });
  }

  async getFixLogs(params = {}) {
    const queryString = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    ).toString();
    return this.request(`/fix-logs${queryString ? '?' + queryString : ''}`);
  }

  async getFixedUrls(projectId, issueKey) {
    return this.request(
      `/fix-logs/fixed-urls?projectId=${encodeURIComponent(projectId)}&issueKey=${encodeURIComponent(issueKey)}`
    );
  }

  // ── Tasks (new lifecycle system) ──────────────────────────────────────

  async createTask(data) {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTaskStatus(taskId, status) {
    return this.request(`/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  /**
   * Applies this task's linked AI recommendation directly to the connected
   * WordPress site (Phase 4). `expectedCurrentValue` should be the live
   * value the UI just showed the user (see useWordPressSeoData) — the
   * backend refuses the write with a 409 CONFLICT if the live value has
   * since changed, rather than overwriting it.
   */
  async applyWordPressFix(taskId, { expectedCurrentValue, approved, additionalProfiles, removeProfiles, expectedAdditionalProfiles, expectedContentFingerprint }) {
    // additionalProfiles / removeProfiles / expectedAdditionalProfiles are sent
    // ONLY for the sameAs fix, where the site owner enters the profile URLs
    // (undefined keys are dropped by JSON.stringify, so every other fix sends
    // exactly what it always did). Nothing here can name a WordPress option,
    // meta key or Rank Math field — the backend fixes the storage location.
    return this.request(`/tasks/${taskId}/apply-wordpress`, {
      method: 'POST',
      // expectedContentFingerprint (page-content/H1 fixes only) is the page state the user reviewed;
      // the backend refuses the write if the page changed since. It is the ONLY thing sent for an H1
      // fix — never content, a post ID or a value.
      body: JSON.stringify({ expectedCurrentValue, approved, additionalProfiles, removeProfiles, expectedAdditionalProfiles, expectedContentFingerprint }),
    });
  }

  /**
   * Links an existing task (created before any AI recommendation existed)
   * to a recommendation, so wordPressSeoFixService.js's server-side
   * RECOMMENDATION_REQUIRED check can find it. Only valid from
   * task_created/reopened — the backend rejects anything else with 409.
   */
  async linkTaskRecommendation(taskId, recommendationId) {
    return this.request(`/tasks/${taskId}/link-recommendation`, {
      method: 'PATCH',
      body: JSON.stringify({ recommendationId }),
    });
  }

  // ── Recommendations ────────────────────────────────────────────────────

  /**
   * Fetches one recommendation by id, scoped to projectId — used to show
   * the EXACT recommendation content a Task.recommendationId points to in
   * the WordPress apply-fix dialog, rather than trusting whatever the
   * recommendation-generation mutation's own local component state holds
   * (which may belong to a different task, or may no longer exist after a
   * page reload).
   */
  async getRecommendationById(recommendationId, projectId) {
    return this.request(`/recommendations/${recommendationId}?projectId=${encodeURIComponent(projectId)}`);
  }

  async getTasks(params = {}) {
    const queryString = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    ).toString();
    return this.request(`/tasks${queryString ? '?' + queryString : ''}`);
  }

  async getTaskById(taskId) {
    return this.request(`/tasks/${taskId}`);
  }

  /**
   * Older fixHistory attempts for one task (Optimization Center View Details
   * "Show earlier attempts") — excludes the latest attempt, which is already
   * included in getTaskById's response.
   */
  async getTaskHistory(taskId, params = {}) {
    const queryString = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    ).toString();
    return this.request(`/tasks/${taskId}/history${queryString ? '?' + queryString : ''}`);
  }

  async getTaskSummary(projectId) {
    return this.request(`/tasks/summary?projectId=${encodeURIComponent(projectId)}`);
  }

  async getActiveTaskUrls(projectId, issueKey) {
    return this.request(
      `/tasks/active-urls?projectId=${encodeURIComponent(projectId)}&issueKey=${encodeURIComponent(issueKey)}`
    );
  }

  async deleteTask(taskId) {
    return this.request(`/tasks/${taskId}`, { method: 'DELETE' });
  }

  // ── Audit History ─────────────────────────────────────────────────────────

  async getLatestComparison(projectId) {
    return this.request(`/projects/${encodeURIComponent(projectId)}/comparison/latest`);
  }

  async getAuditComparison(projectId, from, to) {
    return this.request(
      `/projects/${encodeURIComponent(projectId)}/comparison?from=${from}&to=${to}`
    );
  }

  // ── AISO Hub V2 ────────────────────────────────────────────────────────────

  async getAISOHubData(projectId) {
    return this.request(`/aiso-hub/${projectId}`);
  }

  async getAISOHubIssues(projectId) {
    return this.request(`/aiso-hub/${projectId}/issues`);
  }

  async getAISOHubIssueDetail(projectId, ruleId) {
    return this.request(`/aiso-hub/${projectId}/issues/${encodeURIComponent(ruleId)}`);
  }

  async getAuditHistory(projectId, page = 1, limit = 10) {
    return this.request(
      `/projects/${encodeURIComponent(projectId)}/audits?page=${page}&limit=${limit}`
    );
  }

  async getProjectTrends(projectId, limit = 20) {
    return this.request(
      `/projects/${encodeURIComponent(projectId)}/trends?limit=${limit}`
    );
  }

  async getAiImpact(projectId) {
    return this.request(`/projects/${encodeURIComponent(projectId)}/ai-impact`);
  }

  // ── Google Visibility / Business Profile ────────────────────────────────

  /**
   * Get the Google consent URL for connecting Search Console / Analytics /
   * Business Profile to a project. The caller is expected to navigate the
   * browser to `data.url` (a bare <a href> can't carry the Authorization
   * header this endpoint requires, so we fetch it first).
   */
  async getGoogleConnectUrl(projectId, returnTo) {
    const params = new URLSearchParams({ projectId });
    if (returnTo) params.set('returnTo', returnTo);
    return this.request(`/auth/oauth/google/start?${params.toString()}`);
  }

  // Settings → Connected Accounts (account-level, not project-scoped —
  // distinct from getGoogleConnectUrl/getBusinessProfileStatus above, which
  // are per-project).
  async getGoogleAccountStatus() {
    return this.request('/auth/oauth/google/status');
  }

  // ── Google Services (independent per-service accounts) ──────────────────
  // Settings → Google Services. Project-scoped — one independent connection
  // per service (google_ads/search_console/analytics/business_profile) for
  // whichever project is currently active, unlike getGoogleAccountStatus
  // above (an account-wide rollup used only by the legacy bundled row).
  async getGoogleServiceConnections(projectId) {
    const params = new URLSearchParams({ projectId });
    return this.request(`/auth/oauth/google/connections?${params.toString()}`);
  }

  // Maps a service to its own OAuth start route (see oauth.routes.js) so
  // Connect/Change Account always requests only that one service's scopes
  // and lands on that one service's GoogleConnection row — never the
  // bundled legacy flow. google_ads reuses the existing dedicated
  // getGoogleAdsConnectUrl below rather than duplicating its route mapping.
  async getGoogleServiceConnectUrl(service, projectId, returnTo) {
    if (service === 'google_ads') {
      return this.getGoogleAdsConnectUrl(projectId, returnTo);
    }
    const START_PATHS = {
      search_console: '/auth/oauth/google-search-console/start',
      analytics: '/auth/oauth/google-analytics/start',
      business_profile: '/auth/oauth/google-business-profile/start',
    };
    const path = START_PATHS[service];
    if (!path) throw new Error(`Unknown Google service: ${service}`);
    const params = new URLSearchParams({ projectId });
    if (returnTo) params.set('returnTo', returnTo);
    return this.request(`${path}?${params.toString()}`);
  }

  async disconnectGoogleService(service, projectId) {
    return this.request(`/auth/oauth/google/${encodeURIComponent(service)}/disconnect`, {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
  }

  // ── Meta (Facebook + Instagram) — Phase 1: OAuth foundation ──────────────
  // Same shape/contract as getGoogleConnectUrl above (returns { url }, the
  // caller navigates the browser itself).
  // `reconnect: true` asks the backend for a URL that forces Meta to
  // re-show its permissions dialog (auth_type=rerequest) instead of
  // silently reusing whatever session/grant already exists — the real
  // fix for "Connect" alone never actually re-prompting for a newly
  // required permission like pages_manage_posts. Omit/false for an
  // ordinary first-time Connect, which must never force re-consent.
  async getMetaConnectUrl(projectId, returnTo, reconnect) {
    const params = new URLSearchParams({ projectId });
    if (returnTo) params.set('returnTo', returnTo);
    if (reconnect) params.set('reconnect', 'true');
    // credentials: 'include' lets the browser store the httpOnly cookie that binds this OAuth attempt to this browser (the API's CORS allows credentials for its one configured origin)
    return this.request(`/social/meta/start?${params.toString()}`, { credentials: 'include' });
  }

  // ── Meta (Facebook + Instagram) — Phase 2: Page connection ───────────────
  // Called after the OAuth redirect returns with ?meta_connected=1 — lists
  // the Facebook Pages available to whatever Meta account just completed
  // consent, so the user can pick one. Never returns an access token.
  async getMetaPages(projectId) {
    const params = new URLSearchParams({ projectId });
    return this.request(`/social/meta/pages?${params.toString()}`);
  }

  // Persists the chosen Page as a real SocialAccount. The backend re-checks
  // the pageId against the same server-held Page list getMetaPages just
  // returned — this call intentionally sends nothing but the IDs, never a
  // token, matching the backend's own "client must never send accessToken" contract.
  // As of Phase 3, the response also runs Facebook -> Instagram discovery
  // and returns both results: { data: { facebook: {...}, instagram: {...} } }.
  async selectMetaPage(projectId, pageId) {
    return this.request(`/social/meta/pages/${encodeURIComponent(pageId)}/select`, {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
  }

  // ── Meta (Facebook + Instagram) — Phase 3: Instagram discovery ───────────
  // Re-runs just the Instagram half of the connection, for the "Retry"
  // action after a discovery failure — selectMetaPage's own pending
  // connection is already gone by the time a user could click Retry, so
  // this hits a dedicated endpoint instead of re-selecting the Page.
  async retryMetaInstagramDiscovery(projectId, pageId) {
    return this.request(`/social/meta/pages/${encodeURIComponent(pageId)}/instagram/retry`, {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
  }

  // ── Social accounts — real connection status ──────────────────────────────
  // Sourced entirely from MongoDB (never from OAuth-flow-transient state).
  // Call this on page load, not just once right after a successful
  // connect — this is what makes "Connected" survive a refresh.
  async getSocialAccountsStatus(projectId) {
    const params = new URLSearchParams({ projectId });
    return this.request(`/social/accounts?${params.toString()}`);
  }

  // POST /social/accounts/verify — asks Meta (debug_token, server-side) whether
  // each active connection's token is still valid, updates lastVerifiedAt/
  // expiry, and flips a confirmed-dead connection to 'expired'. Returns
  // token-free per-account health only. User-triggered, never polled.
  async verifySocialAccounts(projectId) {
    return this.request('/social/accounts/verify', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
  }

  // Real Facebook Page data (profile/recent posts/insights) — never
  // mock/demo values. Backend returns connected:false + a reason instead
  // of fake zeros when the stored token is invalid or a metric genuinely
  // isn't available on Meta's side.
  async getFacebookOverview(projectId, range) {
    const params = new URLSearchParams({ projectId });
    if (range) params.set('range', range);
    return this.request(`/social/facebook/overview?${params.toString()}`);
  }

  // Real Instagram Business account data (post count, engagements,
  // followers gained, likes, comments-vs-likes chart) — never mock/demo
  // values. Backend returns connected:false + a reason instead of fake
  // zeros when the stored token is invalid or a metric isn't available.
  async getInstagramOverview(projectId, range) {
    const params = new URLSearchParams({ projectId });
    if (range) params.set('range', range);
    return this.request(`/social/instagram/overview?${params.toString()}`);
  }

  // Switch Account feature — every currently-connected Facebook Page for
  // the project (not just the active one). Safe metadata only, no tokens.
  async getFacebookAccounts(projectId) {
    const params = new URLSearchParams({ projectId });
    return this.request(`/social/facebook/accounts?${params.toString()}`);
  }

  // Switches which already-connected Page is active. NOT an OAuth call —
  // no redirect, no Meta round-trip, just changes which persisted Page
  // the dashboard reads from.
  async switchFacebookAccount(projectId, socialAccountId) {
    return this.request('/social/facebook/switch', {
      method: 'POST',
      body: JSON.stringify({ projectId, socialAccountId }),
    });
  }

  // Deactivates the project's active connection for the given platform
  // ('facebook' | 'instagram'). Soft-revokes the stored SocialAccount —
  // same source of truth getSocialAccountsStatus reads, so both /app/social
  // and Settings -> Profile see the change without a hard refresh once
  // their React Query caches are invalidated.
  // Real Facebook + Instagram Feeds — reads only from MongoDB (never
  // calls Meta directly; see socialFeedService.js). `filters` may include
  // platform/status/search/from/to/sort/page/limit; only defined keys are
  // sent.
  async getSocialFeeds(projectId, filters = {}) {
    const params = new URLSearchParams({ projectId });
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') params.set(key, value);
    }
    return this.request(`/social/feeds?${params.toString()}`);
  }

  // Feeds page Refresh — runs a controlled backend sync of every
  // connected Facebook/Instagram account for the project (Meta calls
  // happen here, server-side only, never in the browser).
  async syncSocialFeeds(projectId) {
    return this.request('/social/feeds/sync', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
  }

  // ── Social Publishing — real drafts/scheduling/publishing ─────────────
  // The browser never talks to Meta directly here; every one of these
  // hits Odito's backend, which loads the token server-side and calls the
  // real platform adapter (see odito_backend's socialPublishingService.js).
  async getSocialPublications(projectId, filters = {}) {
    const params = new URLSearchParams({ projectId });
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') params.set(key, value);
    }
    return this.request(`/social/publishing?${params.toString()}`);
  }

  async createSocialPublication(projectId, payload) {
    return this.request('/social/publishing', {
      method: 'POST',
      body: JSON.stringify({ projectId, ...payload }),
    });
  }

  async updateSocialPublication(projectId, publicationId, updates) {
    return this.request(`/social/publishing/${encodeURIComponent(publicationId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ projectId, ...updates }),
    });
  }

  // `historyOnly` is only meaningful for a published Instagram post — the
  // Graph API has no DELETE for IG Media at all, so the regular Delete
  // action refuses with EXTERNAL_DELETE_UNSUPPORTED unless the caller
  // explicitly opts into removing just the Odito record (see
  // DeletePostConfirmDialog.jsx's "Remove from Odito history" action).
  async deleteSocialPublication(projectId, publicationId, { historyOnly = false } = {}) {
    return this.request(`/social/publishing/${encodeURIComponent(publicationId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ projectId, historyOnly }),
    });
  }

  async publishSocialPublication(projectId, publicationId) {
    return this.request(`/social/publishing/${encodeURIComponent(publicationId)}/publish`, {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
  }

  async cancelSocialPublication(projectId, publicationId) {
    return this.request(`/social/publishing/${encodeURIComponent(publicationId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
  }

  async scheduleSocialPublication(projectId, publicationId, scheduledAt, timezone) {
    return this.request(`/social/publishing/${encodeURIComponent(publicationId)}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ projectId, scheduledAt, timezone }),
    });
  }

  // ── Social Media AI strategy (backend: modules/social_meta/service/aiStrategy/) ──
  // GET -> { status, strategy, generation, profile } (current strategy + latest attempt + how the live Business
  // Profile compares to the one it was generated from). /status is the cheap poll while generating. POST /generate
  // starts (or re-runs) a generation and returns 202 straight away; the strategy itself is read-only.
  async getSocialAIStrategy(projectId) {
    return this.request(`/social/ai-strategy?${new URLSearchParams({ projectId }).toString()}`);
  }

  async getSocialAIStrategyStatus(projectId) {
    return this.request(`/social/ai-strategy/status?${new URLSearchParams({ projectId }).toString()}`);
  }

  // `options` (all optional): { planning: { postsPerWeek, months, platforms }, expectedVersion, requestId }. The server validates every value;
  // a count or a quota is never sent, the server works those out.
  async generateSocialAIStrategy(projectId, options = {}) {
    return this.request('/social/ai-strategy/generate', { method: 'POST', body: JSON.stringify({ projectId, ...options }) });
  }

  // The planner's exact answer for a planning choice (no AI, nothing saved): planned posts, platform states, whether the calendar fits the allowance.
  async previewSocialAIStrategyPlan(projectId, choice) {
    return this.request('/social/ai-strategy/plan-preview', { method: 'POST', body: JSON.stringify({ projectId, ...choice }) });
  }

  // Single-post AI content: POST starts one generation (202), GET reports it (+ the saved draft). Only
  // platform / contentPillar / objective are sent - the server decides everything else.
  async generateSocialAIContent(projectId, { platform, contentPillar, objective }) {
    return this.request('/social/ai-content/generate', { method: 'POST', body: JSON.stringify({ projectId, platform, contentPillar, objective }) });
  }

  // AI design (image) for an approved post: POST starts one generation (202), GET reports it (+ the real publication).
  // Only publicationId / contentVersion / replaceApproved are sent - the server decides everything else.
  async generateSocialAIDesign(projectId, { publicationId, contentVersion, replaceApproved = false }) {
    return this.request('/social/ai-design/generate', { method: 'POST', body: JSON.stringify({ projectId, publicationId, contentVersion, replaceApproved }) });
  }

  async getSocialAIDesignStatus(projectId, publicationId, generationId = null) {
    const params = new URLSearchParams({ projectId, publicationId });
    if (generationId) params.set('generationId', generationId);
    return this.request(`/social/ai-design/status?${params.toString()}`);
  }

  // Creative Studio (same pipeline and record as AI design; candidates are stored but are NOT the post's design until one is selected).
  // GET -> the real post + brand / product / format / gate + the latest three candidates. Bodies carry only ids, versions and the user's
  // own choices (product photos, change instruction); the server decides the post, the account, the format and the brief.
  async getSocialStudio(projectId, publicationId) {
    return this.request(`/social/ai-design/studio?${new URLSearchParams({ projectId, publicationId }).toString()}`);
  }

  async generateSocialStudioDesigns(projectId, { publicationId, contentVersion, productMediaIds, replaceApproved = false }) {
    return this.request('/social/ai-design/studio/generate', { method: 'POST', body: JSON.stringify({ projectId, publicationId, contentVersion, productMediaIds, replaceApproved }) });
  }

  async regenerateSocialStudioDesign(projectId, { publicationId, generationId, candidateId, contentVersion, instruction, productMediaIds, replaceApproved = false }) {
    return this.request('/social/ai-design/studio/regenerate', { method: 'POST', body: JSON.stringify({ projectId, publicationId, generationId, candidateId, contentVersion, instruction, productMediaIds, replaceApproved }) });
  }

  async selectSocialStudioDesign(projectId, { publicationId, generationId, candidateId, contentVersion, designVersion, replaceApproved = false }) {
    return this.request('/social/ai-design/studio/select', { method: 'POST', body: JSON.stringify({ projectId, publicationId, generationId, candidateId, contentVersion, designVersion, replaceApproved }) });
  }

  async getSocialAIContentStatus(projectId, generationId = null) {
    const params = new URLSearchParams({ projectId });
    if (generationId) params.set('generationId', generationId);
    return this.request(`/social/ai-content/status?${params.toString()}`);
  }

  // ── Social Media AI business profile (backend: socialBusinessProfileResolver.js) ──
  // GET -> { resolvedProfile, editableProfile, googleStatus }: Google / project data resolved server-side
  // (each fact labelled with its source) plus the user-entered Social AI fields. PUT updates ONLY the
  // user-entered fields and returns the same shape. The browser never sends or receives a Google id or token.
  async getSocialBusinessProfile(projectId) {
    return this.request(`/social/business-profile?${new URLSearchParams({ projectId }).toString()}`);
  }

  async updateSocialBusinessProfile(projectId, fields) {
    return this.request('/social/business-profile', { method: 'PUT', body: JSON.stringify({ projectId, ...fields }) });
  }

  // multipart upload with progress for ONE image (product image / brand logo). Same XHR pattern as
  // uploadSocialMedia(): the browser sets the multipart Content-Type itself. A refused upload is thrown with the
  // backend's own message, `.status`, and `.details.code` (e.g. INVALID_MEDIA_TYPE, MEDIA_TOO_LARGE) — the shape
  // describeApiError() reads. Only the project id and the file are sent; the backend decides everything else.
  _uploadImage(method, path, projectId, file, onProgress) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, `${this.baseURL}${path}`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        let data;
        try { data = JSON.parse(xhr.responseText); } catch { data = {}; }
        if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
        const error = new Error(data.message || 'Failed to upload the image');
        error.status = xhr.status;
        error.details = data.details;
        error.code = data.details?.code;
        return reject(error);
      };
      xhr.onerror = () => reject(new Error('Network error while uploading the image.'));
      xhr.send(formData);
    });
  }

  // ── Social Media AI brand logo (backend: socialBusinessProfileController.js) ──
  // Both return the re-resolved profile ({ resolvedProfile, editableProfile, googleStatus }), like the PUT.
  uploadSocialBrandLogo(projectId, file, onProgress) {
    return this._uploadImage('POST', '/social/business-profile/logo', projectId, file, onProgress);
  }

  async deleteSocialBrandLogo(projectId) {
    return this.request('/social/business-profile/logo', { method: 'DELETE', body: JSON.stringify({ projectId }) });
  }

  // ── Social Media AI product catalog (backend: socialProductService.js) ──
  // Every response carries the PUBLIC product shape; images are managed only through the image endpoints.
  async listSocialProducts(projectId, { status } = {}) {
    const params = new URLSearchParams({ projectId });
    if (status) params.set('status', status);
    return this.request(`/social/products?${params.toString()}`);
  }

  async getSocialProduct(projectId, productId) {
    return this.request(`/social/products/${encodeURIComponent(productId)}?${new URLSearchParams({ projectId }).toString()}`);
  }

  async createSocialProduct(projectId, fields) {
    return this.request('/social/products', { method: 'POST', body: JSON.stringify({ projectId, ...fields }) });
  }

  async updateSocialProduct(projectId, productId, fields) {
    return this.request(`/social/products/${encodeURIComponent(productId)}`, { method: 'PATCH', body: JSON.stringify({ projectId, ...fields }) });
  }

  async deleteSocialProduct(projectId, productId) {
    return this.request(`/social/products/${encodeURIComponent(productId)}`, { method: 'DELETE', body: JSON.stringify({ projectId }) });
  }

  uploadSocialProductImage(projectId, productId, file, onProgress) {
    return this._uploadImage('POST', `/social/products/${encodeURIComponent(productId)}/images`, projectId, file, onProgress);
  }

  replaceSocialProductImage(projectId, productId, mediaId, file, onProgress) {
    return this._uploadImage('PUT', `/social/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(mediaId)}`, projectId, file, onProgress);
  }

  async deleteSocialProductImage(projectId, productId, mediaId) {
    return this.request(`/social/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(mediaId)}`, { method: 'DELETE', body: JSON.stringify({ projectId }) });
  }

  // { altText?, isPrimary?: true }
  async updateSocialProductImage(projectId, productId, mediaId, fields) {
    return this.request(`/social/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(mediaId)}`, { method: 'PATCH', body: JSON.stringify({ projectId, ...fields }) });
  }

  // { mediaIds: [every image id in the new order], primaryMediaId? }
  async reorderSocialProductImages(projectId, productId, { mediaIds, primaryMediaId } = {}) {
    return this.request(`/social/products/${encodeURIComponent(productId)}/images/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ projectId, mediaIds, ...(primaryMediaId ? { primaryMediaId } : {}) }),
    });
  }

  // ── Social Media AI content calendar (backend: socialContentCalendarService.js) ──
  // The plan between the strategy and content generation. GET returns the current calendar, its items, the latest
  // attempt, what the user can choose and whether it is out of date; POST /generate starts a generation (202) from
  // the user's own choices only: { startDate, months (1-6), postsPerWeek, platforms, distributionMode }. The server derives the
  // end date (a legacy { startDate, endDate } is still accepted). The strategy, profile and catalog are always loaded by the
  // server. POST /preview answers, without any AI call, what a set of choices means: the end date and the exact post count.
  async getSocialContentCalendar(projectId) {
    return this.request(`/social/content-calendar?${new URLSearchParams({ projectId }).toString()}`);
  }

  async getSocialContentCalendarStatus(projectId) {
    return this.request(`/social/content-calendar/status?${new URLSearchParams({ projectId }).toString()}`);
  }

  async generateSocialContentCalendar(projectId, choices) {
    return this.request('/social/content-calendar/generate', { method: 'POST', body: JSON.stringify({ projectId, ...choices }) });
  }

  async previewSocialContentCalendar(projectId, choices) {
    return this.request('/social/content-calendar/preview', { method: 'POST', body: JSON.stringify({ projectId, ...choices }) });
  }

  // A calendar that stopped after saving some posts is `partial`: resume continues it (only the missing posts are generated, 202);
  // cancel stops an unfinished calendar and discards what it saved. The last ready calendar is never touched by either.
  async resumeSocialContentCalendar(projectId) {
    return this.request('/social/content-calendar/resume', { method: 'POST', body: JSON.stringify({ projectId }) });
  }

  async cancelSocialContentCalendar(projectId) {
    return this.request('/social/content-calendar/cancel', { method: 'POST', body: JSON.stringify({ projectId }) });
  }

  // Calendar history (backend: calendarHistoryService.js): every version of the calendar that can be opened, one version's posts
  // (read-only) and restore (an archived version becomes the current calendar again, whole).
  async getSocialCalendarHistory(projectId) {
    return this.request(`/social/content-calendar/history?${new URLSearchParams({ projectId }).toString()}`);
  }

  async getSocialCalendarVersion(projectId, calendarId) {
    return this.request(`/social/content-calendar/history/${encodeURIComponent(calendarId)}?${new URLSearchParams({ projectId }).toString()}`);
  }

  async restoreSocialCalendarVersion(projectId, calendarId) {
    return this.request('/social/content-calendar/restore', { method: 'POST', body: JSON.stringify({ projectId, calendarId }) });
  }

  // The per-item workspace of the calendar (backend: socialContentCalendarItemService.js). The server owns every rule; the
  // client sends only the fields a person edited plus the `expectedRevision` it saw (a stale one is refused with the current item).
  async getSocialCalendarOptions(projectId) {
    return this.request(`/social/content-calendar/options?${new URLSearchParams({ projectId }).toString()}`);
  }

  async createSocialCalendarItem(projectId, fields) {
    return this.request('/social/content-calendar/items', { method: 'POST', body: JSON.stringify({ projectId, ...fields }) });
  }

  async updateSocialCalendarItem(projectId, itemId, { expectedRevision, ...fields }) {
    return this.request(`/social/content-calendar/items/${encodeURIComponent(itemId)}`, { method: 'PATCH', body: JSON.stringify({ projectId, expectedRevision, ...fields }) });
  }

  async approveSocialCalendarItem(projectId, itemId, expectedRevision) {
    return this.request(`/social/content-calendar/items/${encodeURIComponent(itemId)}/approve`, { method: 'POST', body: JSON.stringify({ projectId, expectedRevision }) });
  }

  async revokeSocialCalendarItemApproval(projectId, itemId, expectedRevision) {
    return this.request(`/social/content-calendar/items/${encodeURIComponent(itemId)}/revoke-approval`, { method: 'POST', body: JSON.stringify({ projectId, expectedRevision }) });
  }

  async regenerateSocialCalendarItem(projectId, itemId, { expectedRevision, fields, overwriteEdited = false }) {
    return this.request(`/social/content-calendar/items/${encodeURIComponent(itemId)}/regenerate`, { method: 'POST', body: JSON.stringify({ projectId, expectedRevision, fields, overwriteEdited }) });
  }

  // Creates the post draft for one platform. mode 'plan' (needs the revision the person saw) uses the reviewed caption of the plan verbatim
  // and answers 201 with the draft; mode 'ai' has the AI write a NEW caption (202, then poll the AI content status); with no mode the
  // server uses the plan's caption when it has one and AI otherwise.
  async generateSocialCalendarItemContent(projectId, itemId, platform, { mode, expectedRevision } = {}) {
    return this.request(`/social/content-calendar/items/${encodeURIComponent(itemId)}/generate-content`, {
      method: 'POST',
      body: JSON.stringify({ projectId, platform, ...(mode ? { mode } : {}), ...(expectedRevision !== undefined ? { expectedRevision } : {}) }),
    });
  }

  // ── Social content approval workflow (backend: approvalWorkflow.js) ────
  // The backend owns every transition, version check and setting; these only
  // carry the reviewer's action. approve/request-changes carry the `version`
  // the reviewer SAW — a stale one is refused with VERSION_MISMATCH.
  async submitSocialContentForReview(projectId, publicationId) {
    return this.request(`/social/publishing/${encodeURIComponent(publicationId)}/content/submit`, { method: 'POST', body: JSON.stringify({ projectId }) });
  }

  async approveSocialContent(projectId, publicationId, version) {
    return this.request(`/social/publishing/${encodeURIComponent(publicationId)}/content/approve`, { method: 'POST', body: JSON.stringify({ projectId, version }) });
  }

  async requestSocialContentChanges(projectId, publicationId, version, reason) {
    return this.request(`/social/publishing/${encodeURIComponent(publicationId)}/content/request-changes`, { method: 'POST', body: JSON.stringify({ projectId, version, reason }) });
  }

  async submitSocialDesignForReview(projectId, publicationId) {
    return this.request(`/social/publishing/${encodeURIComponent(publicationId)}/design/submit`, { method: 'POST', body: JSON.stringify({ projectId }) });
  }

  async approveSocialDesign(projectId, publicationId, version) {
    return this.request(`/social/publishing/${encodeURIComponent(publicationId)}/design/approve`, { method: 'POST', body: JSON.stringify({ projectId, version }) });
  }

  async requestSocialDesignChanges(projectId, publicationId, version, reason) {
    return this.request(`/social/publishing/${encodeURIComponent(publicationId)}/design/request-changes`, { method: 'POST', body: JSON.stringify({ projectId, version, reason }) });
  }

  // Database counts for the Overview tiles: { contentReview, designReview, awaitingDesignSubmission, readyToSchedule, needsChanges }.
  async getSocialApprovalSummary(projectId) {
    return this.request(`/social/publishing/approvals/summary?${new URLSearchParams({ projectId }).toString()}`);
  }

  async getSocialApprovalSettings(projectId) {
    return this.request(`/social/publishing/approval-settings?${new URLSearchParams({ projectId }).toString()}`);
  }

  async updateSocialApprovalSettings(projectId, settings) {
    return this.request('/social/publishing/approval-settings', { method: 'PUT', body: JSON.stringify({ projectId, ...settings }) });
  }

  // Real media upload for a social post (image/video -> a public HTTPS
  // URL the Facebook/Instagram Graph API adapters can hand to Meta). Same
  // FormData/XHR pattern as uploadAvatar() above — the browser sets its
  // own multipart Content-Type header (with boundary), which is why this
  // does not go through this.request()'s JSON-only config. onProgress
  // (percent) is optional.
  uploadSocialMedia(projectId, file, onProgress) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.baseURL}/social/media/upload`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        let data;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = {};
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          const error = new Error(data.message || 'Failed to upload media');
          error.code = data.details?.code;
          reject(error);
        }
      };

      xhr.onerror = () => reject(new Error('Network error while uploading media.'));

      xhr.send(formData);
    });
  }

  // ── Bulk Social Publishing Upload (backend Phases 2 & 3) ───────────────
  // Multi-step CSV/XLSX import: validate → preview → import. The server
  // reuses the existing single-post publishing pipeline; the frontend
  // never validates rows, publishes, or schedules anything itself.

  /**
   * multipart/form-data upload → parse + server-side validation. Returns
   * { data: { batch, validation: { total, valid, invalid } } } on a
   * structurally valid file; throws with .code / .details / .status
   * (matching handleResponse) on a file-level failure — .details.batchId
   * is the failed batch so the caller can still GET it.
   */
  validateBulkUpload(projectId, file) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('file', file);
    return fetch(`${this.baseURL}/social/publishing/bulk-upload/validate`, {
      method: 'POST',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData,
    }).then(async (res) => {
      let data = {};
      try { data = await res.json(); } catch { /* non-JSON error body */ }
      if (!res.ok) {
        const error = new Error(data.message || 'Failed to validate the file');
        error.code = data.code;
        error.details = data.details;
        error.status = res.status;
        throw error;
      }
      return data;
    });
  }

  getBulkUploadBatch(projectId, batchId) {
    const params = new URLSearchParams({ projectId });
    return this.request(`/social/publishing/bulk-upload/${encodeURIComponent(batchId)}?${params.toString()}`);
  }

  getBulkUploadRows(projectId, batchId, { status, page = 1, limit = 50 } = {}) {
    const params = new URLSearchParams({ projectId, page: String(page), limit: String(limit) });
    if (status) params.set('status', status);
    return this.request(`/social/publishing/bulk-upload/${encodeURIComponent(batchId)}/rows?${params.toString()}`);
  }

  importBulkUpload(projectId, batchId, mode) {
    return this.request(`/social/publishing/bulk-upload/${encodeURIComponent(batchId)}/import`, {
      method: 'POST',
      body: JSON.stringify({ projectId, mode }),
    });
  }

  downloadBulkUploadTemplate(projectId) {
    return this.downloadCsvBlob('/social/publishing/bulk-upload/template', { projectId }, 'odito-bulk-upload-template.csv');
  }

  downloadBulkUploadErrors(projectId, batchId) {
    const safeId = String(batchId).replace(/[^a-z0-9]/gi, '').slice(0, 32) || 'batch';
    return this.downloadCsvBlob(
      `/social/publishing/bulk-upload/${encodeURIComponent(batchId)}/errors`,
      { projectId, format: 'csv' },
      `odito-bulk-upload-errors-${safeId}.csv`,
    );
  }

  /**
   * Shared CSV blob download — carries the Authorization header a bare
   * <a href> can't (same reason as downloadWordPressPlugin), then drives
   * the download via a temporary object URL. Prefers the server's
   * Content-Disposition filename; the fallback name never contains the
   * user's uploaded filename.
   */
  async downloadCsvBlob(endpoint, query, fallbackName) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const qs = new URLSearchParams(query).toString();
    const res = await fetch(`${this.baseURL}${endpoint}?${qs}`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    });
    if (!res.ok) {
      let data = {};
      try { data = await res.json(); } catch { /* */ }
      const error = new Error(data.message || 'Failed to download the file');
      error.code = data.code;
      error.details = data.details;
      error.status = res.status;
      throw error;
    }
    const blob = await res.blob();
    let filename = fallbackName;
    const cd = res.headers.get('Content-Disposition');
    const match = cd && cd.match(/filename="?([^"]+)"?/i);
    if (match && /^[\w.\- ]+\.csv$/i.test(match[1])) filename = match[1];
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  async disconnectSocialAccount(projectId, platform) {
    return this.request(`/social/accounts/${encodeURIComponent(platform)}`, {
      method: 'DELETE',
      body: JSON.stringify({ projectId }),
    });
  }

  async disconnectGoogleAccount() {
    return this.request('/auth/oauth/google/disconnect', { method: 'POST' });
  }

  async getBusinessProfileStatus(projectId) {
    return this.request(`/projects/${projectId}/business-profile/status`);
  }

  async getBusinessProfileAccounts(projectId) {
    return this.request(`/projects/${projectId}/business-profile/accounts`);
  }

  async getBusinessProfileLocations(projectId, accountId) {
    return this.request(`/projects/${projectId}/business-profile/locations?accountId=${encodeURIComponent(accountId)}`);
  }

  async selectBusinessProfile(projectId, accountId, locationId) {
    return this.request(`/projects/${projectId}/business-profile/select`, {
      method: 'POST',
      body: JSON.stringify({ accountId, locationId })
    });
  }

  async syncBusinessProfile(projectId) {
    return this.request(`/projects/${projectId}/business-profile/sync`, {
      method: 'POST'
    });
  }

  async getBusinessProfileRating(projectId) {
    return this.request(`/projects/${projectId}/business-profile/rating`);
  }

  async getBusinessProfileReviews(projectId, { page = 1, limit = 20, search = '', rating = '', replied = '', sort = '' } = {}) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('search', search);
    if (rating) params.set('rating', String(rating));
    if (replied) params.set('replied', String(replied));
    if (sort) params.set('sort', sort);
    return this.request(`/projects/${projectId}/business-profile/reviews?${params.toString()}`);
  }

  /** One consolidated, server-aggregated analytics payload for the Reviews dashboard. */
  async getBusinessProfileReviewAnalytics(projectId, { range = '90d', tz = '' } = {}) {
    const params = new URLSearchParams({ range });
    if (tz) params.set('tz', tz);
    return this.request(`/projects/${projectId}/business-profile/reviews/analytics?${params.toString()}`);
  }

  /** REAL reply to a Google review (backend verifies ownership, then calls Google). */
  async replyToBusinessProfileReview(projectId, reviewId, reply) {
    return this.request(`/projects/${projectId}/business-profile/reviews/${encodeURIComponent(reviewId)}/reply`, {
      method: 'POST',
      body: JSON.stringify({ reply })
    });
  }

  async syncBusinessProfileReviews(projectId) {
    return this.request(`/projects/${projectId}/business-profile/sync-reviews`, {
      method: 'POST'
    });
  }

  async getBusinessProfileData(projectId) {
    return this.request(`/projects/${projectId}/business-profile/data`);
  }

  async getBusinessProfileDetails(projectId) {
    return this.request(`/projects/${projectId}/business-profile/profile`);
  }

  async getBusinessProfileTrends(projectId, range = '30') {
    return this.request(`/projects/${projectId}/business-profile/trends?range=${encodeURIComponent(range)}`);
  }

  async getBusinessProfileMedia(projectId, { page = 1, limit = 24, category = '' } = {}) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (category) params.set('category', category);
    return this.request(`/projects/${projectId}/business-profile/media?${params.toString()}`);
  }

  async syncBusinessProfileMedia(projectId) {
    return this.request(`/projects/${projectId}/business-profile/sync-media`, {
      method: 'POST'
    });
  }

  async getBusinessProfilePosts(projectId, { page = 1, limit = 10, topicType = '', state = '', search = '', sort = 'newest' } = {}) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (topicType && topicType !== 'ALL') params.set('topicType', topicType);
    if (state && state !== 'ALL') params.set('state', state);
    if (search) params.set('search', search);
    if (sort) params.set('sort', sort);
    return this.request(`/projects/${projectId}/business-profile/posts?${params.toString()}`);
  }

  async createBusinessProfilePost(projectId, postData) {
    return this.request(`/projects/${projectId}/business-profile/posts`, {
      method: 'POST',
      body: JSON.stringify(postData)
    });
  }

  async updateBusinessProfilePost(projectId, postId, postData) {
    return this.request(`/projects/${projectId}/business-profile/posts/${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      body: JSON.stringify(postData)
    });
  }

  async deleteBusinessProfilePost(projectId, postId) {
    return this.request(`/projects/${projectId}/business-profile/posts/${encodeURIComponent(postId)}`, {
      method: 'DELETE'
    });
  }

  async syncBusinessProfilePosts(projectId) {
    return this.request(`/projects/${projectId}/business-profile/sync-posts`, {
      method: 'POST'
    });
  }

  uploadBusinessProfilePostMedia(projectId, file, onProgress) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.baseURL}/projects/${projectId}/business-profile/posts/media`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        let data;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = {};
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          const error = new Error(data.message || 'Failed to upload image');
          error.code = data.code || data.details?.code;
          reject(error);
        }
      };

      xhr.onerror = () => reject(new Error('Network error while uploading image.'));

      xhr.send(formData);
    });
  }

  async deleteBusinessProfilePostMedia(projectId, filename) {
    return this.request(`/projects/${projectId}/business-profile/posts/media/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
  }

  // ── Brand Asset Resolver ────────────────────────────────────
  // Platform-wide "what logo should we show" resolver - see
  // odito_backend/src/services/brandAssetService.js. Reused anywhere a
  // project's branding is displayed (Business Profile, Dashboard, Project
  // List, ...).
  async getProjectBrandAsset(projectId, { force = false } = {}) {
    const params = force ? '?force=true' : ''
    return this.request(`/projects/${projectId}/brand-asset${params}`);
  }

  // ── Search Console ───────────────────────────────────────────
  async getSearchConsoleStatus(projectId) {
    return this.request(`/projects/${projectId}/search-console/status`);
  }

  async getSearchConsoleSites(projectId) {
    return this.request(`/projects/${projectId}/search-console/sites`);
  }

  async selectSearchConsoleSite(projectId, siteUrl) {
    return this.request(`/projects/${projectId}/search-console/select-site`, {
      method: 'POST',
      body: JSON.stringify({ siteUrl })
    });
  }

  async syncSearchConsole(projectId) {
    return this.request(`/projects/${projectId}/search-console/sync`, {
      method: 'POST'
    });
  }

  async getSearchConsoleData(projectId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/projects/${projectId}/search-console/data${query ? `?${query}` : ''}`);
  }

  async getSearchConsoleTrends(projectId, range = '30') {
    return this.request(`/projects/${projectId}/search-console/trends?range=${range}`);
  }

  async getSearchConsoleBreakdown(projectId, dimension) {
    return this.request(`/projects/${projectId}/search-console/breakdown?dimension=${dimension}`);
  }

  async getSearchConsoleSitemaps(projectId) {
    return this.request(`/projects/${projectId}/search-console/sitemaps`);
  }

  async inspectSearchConsoleUrl(projectId, url) {
    return this.request(`/projects/${projectId}/search-console/inspect-url`, {
      method: 'POST',
      body: JSON.stringify({ url })
    });
  }

  // ── Analytics (GA4) ──────────────────────────────────────────
  async getAnalyticsStatus(projectId) {
    return this.request(`/projects/${projectId}/analytics/status`);
  }

  async getAnalyticsProperties(projectId) {
    return this.request(`/projects/${projectId}/analytics/properties`);
  }

  async selectAnalyticsProperty(projectId, propertyId) {
    return this.request(`/projects/${projectId}/analytics/select-property`, {
      method: 'POST',
      body: JSON.stringify({ propertyId })
    });
  }

  async syncAnalytics(projectId) {
    return this.request(`/projects/${projectId}/analytics/sync`, {
      method: 'POST'
    });
  }

  async getAnalyticsData(projectId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/projects/${projectId}/analytics/data${query ? `?${query}` : ''}`);
  }

  async getAnalyticsTrends(projectId, range = '30') {
    return this.request(`/projects/${projectId}/analytics/trends?range=${encodeURIComponent(range)}`);
  }

  async getAnalyticsPropertyDetails(projectId) {
    return this.request(`/projects/${projectId}/analytics/property`);
  }

  async getAnalyticsBreakdowns(projectId, range = '30') {
    return this.request(`/projects/${projectId}/analytics/breakdowns?range=${encodeURIComponent(range)}`);
  }

  async getAnalyticsEventsList(projectId, range = '30') {
    return this.request(`/projects/${projectId}/analytics/events?range=${encodeURIComponent(range)}`);
  }

  async getAnalyticsConversionsList(projectId, range = '30') {
    return this.request(`/projects/${projectId}/analytics/conversions?range=${encodeURIComponent(range)}`);
  }

  async getAnalyticsRealtime(projectId) {
    return this.request(`/projects/${projectId}/analytics/realtime`);
  }

  async getAnalyticsHealth(projectId, range = '30') {
    return this.request(`/projects/${projectId}/analytics/health?range=${encodeURIComponent(range)}`);
  }

  async getAnalyticsActivity(projectId) {
    return this.request(`/projects/${projectId}/analytics/activity`);
  }

  // ── Google Ads ───────────────────────────────────────────────
  // Separate OAuth purpose from Business Profile/Search Console/Analytics
  // above (its own consent screen, its own GoogleConnection row - see
  // odito_backend oauth.routes.js's "google_ads" branch) - hence its own
  // /google-ads/start endpoint rather than reusing getGoogleConnectUrl.
  async getGoogleAdsConnectUrl(projectId, returnTo) {
    const params = new URLSearchParams({ projectId });
    if (returnTo) params.set('returnTo', returnTo);
    return this.request(`/auth/oauth/google-ads/start?${params.toString()}`);
  }

  async getGoogleAdsSyncStatus(projectId) {
    return this.request(`/projects/${projectId}/google-ads/sync-status`);
  }

  async getGoogleAdsAccounts(projectId) {
    return this.request(`/projects/${projectId}/google-ads/accounts`);
  }

  async selectGoogleAdsAccount(projectId, customerId, loginCustomerId) {
    return this.request(`/projects/${projectId}/google-ads/select`, {
      method: 'POST',
      body: JSON.stringify({ customerId, loginCustomerId: loginCustomerId || undefined })
    });
  }

  async refreshGoogleAdsSync(projectId) {
    return this.request(`/projects/${projectId}/google-ads/refresh`, {
      method: 'POST'
    });
  }

  // ── Google Ads dashboard reads (Phase 7.2 / Phase 2 Enterprise Historical Sync) ──
  // All read from MongoDB server-side (never call Google directly) - see
  // googleAdsController.js. Every function here is a thin, uniform wrapper
  // over the shared `this.request()` helper - no request logic is
  // duplicated, only the endpoint path + query-string construction differs
  // per call, matching every other section of this file (e.g. getAnalyticsTrends above).

  /**
   * Turns a GoogleAdsDateRangeSelector value ({preset, startDate, endDate})
   * into the query params the backend's resolveGoogleAdsDateRange expects -
   * `range=7d|30d|90d|12m|all` for presets, `startDate`/`endDate` for
   * 'custom'. The ONE place this translation happens, so every range-aware
   * Google Ads call below builds an identical query string for the same
   * selector value instead of five slightly-different implementations.
   */
  _googleAdsRangeParams(dateRange) {
    const dr = dateRange || { preset: '30d' };
    if (dr.preset === 'custom' && dr.startDate && dr.endDate) {
      return { startDate: dr.startDate, endDate: dr.endDate };
    }
    return { range: dr.preset || '30d' };
  }

  async getGoogleAdsOverview(projectId, dateRange) {
    const params = new URLSearchParams(this._googleAdsRangeParams(dateRange));
    return this.request(`/projects/${projectId}/google-ads/overview?${params.toString()}`);
  }

  async getGoogleAdsTrends(projectId, dateRange, granularity = 'daily', campaignId = null) {
    const params = new URLSearchParams({ ...this._googleAdsRangeParams(dateRange), granularity });
    if (campaignId) params.set('campaignId', campaignId);
    return this.request(`/projects/${projectId}/google-ads/trends?${params.toString()}`);
  }

  async getGoogleAdsCampaigns(projectId, { page = 1, limit = 25, status, search, includeRemoved, dateRange } = {}) {
    const params = new URLSearchParams({ page, limit, ...this._googleAdsRangeParams(dateRange) });
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    if (includeRemoved) params.set('includeRemoved', 'true');
    return this.request(`/projects/${projectId}/google-ads/campaigns?${params.toString()}`);
  }

  async getGoogleAdsCampaignDetail(projectId, campaignId, dateRange) {
    const params = new URLSearchParams(this._googleAdsRangeParams(dateRange));
    return this.request(`/projects/${projectId}/google-ads/campaigns/${campaignId}?${params.toString()}`);
  }

  async getGoogleAdsCampaignHealth(projectId) {
    return this.request(`/projects/${projectId}/google-ads/campaigns/health`);
  }

  async getGoogleAdsCampaignHealthSummary(projectId) {
    return this.request(`/projects/${projectId}/google-ads/campaigns/health/summary`);
  }

  async getGoogleAdsKeywords(projectId, { page = 1, limit = 25, campaignId, matchType, status, search, sortBy = 'cost', sortOrder = -1, startDate, endDate } = {}) {
    const params = new URLSearchParams({ page, limit, sortBy, sortOrder });
    if (campaignId) params.set('campaignId', campaignId);
    if (matchType) params.set('matchType', matchType);
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return this.request(`/projects/${projectId}/google-ads/keywords?${params.toString()}`);
  }

  async getGoogleAdsKeywordDetail(projectId, adGroupId, criterionId) {
    return this.request(`/projects/${projectId}/google-ads/keywords/${adGroupId}/${criterionId}`);
  }

  async refreshGoogleAdsKeywords(projectId) {
    return this.request(`/projects/${projectId}/google-ads/keywords/refresh`, { method: 'POST' });
  }

  async getGoogleAdsSearchTerms(projectId, { page = 1, limit = 25, campaignId, suggestedAction, search, sortBy = 'cost', sortOrder = -1, startDate, endDate } = {}) {
    const params = new URLSearchParams({ page, limit, sortBy, sortOrder });
    if (campaignId) params.set('campaignId', campaignId);
    if (suggestedAction) params.set('suggestedAction', suggestedAction);
    if (search) params.set('search', search);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return this.request(`/projects/${projectId}/google-ads/search-terms?${params.toString()}`);
  }

  async getGoogleAdsOptimizationScore(projectId, dateRange) {
    const params = new URLSearchParams(this._googleAdsRangeParams(dateRange));
    return this.request(`/projects/${projectId}/google-ads/optimization-score?${params.toString()}`);
  }

  async getGoogleAdsRecommendations(projectId, { page = 1, limit = 25, status, type, campaignId, includeResolved } = {}) {
    const params = new URLSearchParams({ page, limit });
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (campaignId) params.set('campaignId', campaignId);
    if (includeResolved) params.set('includeResolved', 'true');
    return this.request(`/projects/${projectId}/google-ads/recommendations?${params.toString()}`);
  }

  async refreshGoogleAdsRecommendations(projectId) {
    return this.request(`/projects/${projectId}/google-ads/recommendations/refresh`, { method: 'POST' });
  }

  async getGoogleAdsDevicePerformance(projectId, dateRange) {
    const params = new URLSearchParams(this._googleAdsRangeParams(dateRange));
    return this.request(`/projects/${projectId}/google-ads/device-performance?${params.toString()}`);
  }

  async getGoogleAdsGeoPerformance(projectId, { level = 'country', page = 1, limit = 25, search, sortBy = 'cost', sortOrder = -1 } = {}) {
    const params = new URLSearchParams({ level, page, limit, sortBy, sortOrder });
    if (search) params.set('search', search);
    return this.request(`/projects/${projectId}/google-ads/geo-performance?${params.toString()}`);
  }

  async getGoogleAdsAudiencePerformance(projectId) {
    return this.request(`/projects/${projectId}/google-ads/audience-performance`);
  }

  async getGoogleAdsAdPerformance(projectId, { page = 1, limit = 25, campaignId, adType, includeRemoved, sortBy = 'cost', sortOrder = -1, groupBy } = {}) {
    const params = new URLSearchParams({ page, limit, sortBy, sortOrder });
    if (campaignId) params.set('campaignId', campaignId);
    if (adType) params.set('adType', adType);
    if (includeRemoved) params.set('includeRemoved', 'true');
    if (groupBy) params.set('groupBy', groupBy);
    return this.request(`/projects/${projectId}/google-ads/ads?${params.toString()}`);
  }

  async getGoogleAdsBudgetOverview(projectId) {
    return this.request(`/projects/${projectId}/google-ads/budget/overview`);
  }

  async getGoogleAdsBudgetForecast(projectId) {
    return this.request(`/projects/${projectId}/google-ads/budget/forecast`);
  }

  async getGoogleAdsAttribution(projectId) {
    return this.request(`/projects/${projectId}/google-ads/attribution`);
  }

  async getGoogleAdsCapabilities(projectId) {
    return this.request(`/projects/${projectId}/google-ads/capabilities`);
  }

  async getGoogleAdsActivity(projectId, { limit = 20, lookbackDays = 14 } = {}) {
    const params = new URLSearchParams({ limit, lookbackDays });
    return this.request(`/projects/${projectId}/google-ads/activity?${params.toString()}`);
  }

  // ── WordPress Connection (Phase 2 — connect/verify/status/disconnect
  // only; not the mock /app/wordpress dashboard) ──────────────────────────

  async connectWordPress(projectId, { siteUrl, username, applicationPassword }) {
    return this.request('/wordpress/connect', {
      method: 'POST',
      body: JSON.stringify({ projectId, siteUrl, username, applicationPassword }),
    });
  }

  async getWordPressStatus(projectId) {
    const params = new URLSearchParams({ projectId });
    return this.request(`/wordpress/status?${params.toString()}`);
  }

  async verifyWordPressConnection(projectId) {
    return this.request('/wordpress/verify', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
  }

  async disconnectWordPress(projectId) {
    const params = new URLSearchParams({ projectId });
    return this.request(`/wordpress/disconnect?${params.toString()}`, { method: 'DELETE' });
  }

  // ── WordPress SEO provider detection + live data (Phase 4, Step 1-2) ───

  async getWordPressCapabilities(projectId) {
    const params = new URLSearchParams({ projectId });
    return this.request(`/wordpress/capabilities?${params.toString()}`);
  }

  async getWordPressSeoData(projectId, pageUrl) {
    const params = new URLSearchParams({ projectId, pageUrl });
    return this.request(`/wordpress/seo-data?${params.toString()}`);
  }

  // Site-level schema (Organization sameAs, breadcrumbs) — always resolves
  // with `data.supported` true/false, never a thrown error for "this site's
  // Bridge doesn't support this yet."
  async getWordPressSiteSchema(projectId) {
    const params = new URLSearchParams({ projectId });
    return this.request(`/wordpress/site-schema?${params.toString()}`);
  }

  // Does this page URL resolve to a WordPress page/post? Always resolves with `data.resolved`
  // true/false and, when false, a `reason` + `message` (different site, blog-index homepage,
  // unsupported content type, not exposed by REST).
  async getWordPressPageResolution(projectId, pageUrl) {
    const params = new URLSearchParams({ projectId, pageUrl });
    return this.request(`/wordpress/page-resolution?${params.toString()}`);
  }

  // Page-content (H1) fix eligibility. Always resolves with `data.supported` true/false and a
  // `reason`; `recommended` is only PREVIEWED by the backend, never written from here.
  async getWordPressH1Context(projectId, pageUrl, recommended) {
    const params = new URLSearchParams({ projectId, pageUrl });
    if (typeof recommended === 'string' && recommended) params.set('recommended', recommended);
    return this.request(`/wordpress/h1-context?${params.toString()}`);
  }

  // ── WordPress Plugin (Phase 3A — pairing, plugin status, detected
  // forms; not form submission capture, which is Phase 3B) ───────────────

  async generateWordPressPairingToken(projectId) {
    return this.request('/wordpress/plugin/pairing-token', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
  }

  async getWordPressPluginStatus(projectId) {
    const params = new URLSearchParams({ projectId });
    return this.request(`/wordpress/plugin/status?${params.toString()}`);
  }

  async getWordPressForms(projectId) {
    const params = new URLSearchParams({ projectId });
    return this.request(`/wordpress/plugin/forms?${params.toString()}`);
  }

  /**
   * Triggers a browser download of the plugin .zip. A bare <a href> can't
   * carry the Authorization header this endpoint requires (same reasoning
   * as getGoogleConnectUrl above), so this fetches the file as a blob first
   * and drives the download via a temporary object URL.
   */
  async downloadWordPressPlugin() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`${this.baseURL}/wordpress/plugin/download`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    });
    if (!response.ok) {
      throw new Error('Failed to download the Odito plugin package.');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'odito-lead-capture.zip';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Same download mechanics as downloadWordPressPlugin() above, for the
   * separate, unrelated Odito SEO Bridge plugin (odito-seo-bridge/).
   */
  async downloadSeoBridgePlugin() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`${this.baseURL}/wordpress/plugin/seo-bridge/download`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    });
    if (!response.ok) {
      throw new Error('Failed to download the Odito SEO Bridge plugin package.');
    }
    // The server names the file after the version it actually built
    // (odito-seo-bridge-<version>.zip), so the user can see what they got.
    const disposition = response.headers?.get?.('Content-Disposition') || '';
    const serverFileName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = serverFileName || 'odito-seo-bridge.zip';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  // ── Leads (Phase 3B — real backend, replaces the /app/leads mock) ──────

  async getLeads(projectId, { status, priority, search, page = 1, limit = 20, sort, sortOrder } = {}) {
    const params = new URLSearchParams({ projectId, page: String(page), limit: String(limit) });
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);
    if (search) params.set('search', search);
    if (sort) params.set('sort', sort);
    if (sortOrder) params.set('sortOrder', sortOrder);
    return this.request(`/leads?${params.toString()}`);
  }

  async getLeadStats(projectId) {
    const params = new URLSearchParams({ projectId });
    return this.request(`/leads/stats?${params.toString()}`);
  }

  async getLead(leadId) {
    return this.request(`/leads/${leadId}`);
  }

  async createLead(projectId, payload) {
    return this.request('/leads', {
      method: 'POST',
      body: JSON.stringify({ projectId, ...payload }),
    });
  }

  async updateLead(leadId, updates) {
    return this.request(`/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteLead(leadId) {
    return this.request(`/leads/${leadId}`, { method: 'DELETE' });
  }

  // ── AI Campaign Builder (Phase 3 frontend for the Phase 1/2 backend) ────
  // All routes under /api/google-ads/ai-campaigns (odito_backend
  // src/modules/aiCampaign/routes/aiCampaignRoutes.js). The browser NEVER
  // talks to Claude/Anthropic or the Google Ads API — only these endpoints.

  /**
   * POST /google-ads/ai-campaigns/generate — Claude generates a campaign
   * from a brief and persists it as an AiCampaignDraft (status 'ready' on
   * success). googleAdsCustomerId is optional; when omitted the backend
   * resolves it from the project's connected Google Ads account.
   */
  async generateAiCampaign(projectId, brief, googleAdsCustomerId) {
    return this.request('/google-ads/ai-campaigns/generate', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        brief,
        ...(googleAdsCustomerId ? { googleAdsCustomerId } : {}),
      }),
    });
  }

  /** GET /google-ads/ai-campaigns/drafts — the project's campaign drafts. */
  async getAiCampaignDrafts(projectId, { status, page = 1, limit = 20, sort, sortOrder } = {}) {
    const params = new URLSearchParams({ projectId, page: String(page), limit: String(limit) });
    if (status) params.set('status', status);
    if (sort) params.set('sort', sort);
    if (sortOrder) params.set('sortOrder', sortOrder);
    return this.request(`/google-ads/ai-campaigns/drafts?${params.toString()}`);
  }

  /** GET /google-ads/ai-campaigns/drafts/:draftId — one draft. */
  async getAiCampaignDraft(draftId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}`);
  }

  /**
   * PATCH /google-ads/ai-campaigns/drafts/:draftId — whole-draft update.
   * Accepts { campaign?, adGroups?, googleAdsCustomerId? }. `campaign`, when
   * sent, must be the COMPLETE campaign object (the backend replaces the
   * sub-document). Never send status/version/aiMetadata — the backend
   * rejects them.
   */
  async updateAiCampaignDraft(draftId, updates) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /** DELETE /google-ads/ai-campaigns/drafts/:draftId — soft delete (draft/failed only). */
  async deleteAiCampaignDraft(draftId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}`, { method: 'DELETE' });
  }

  // ── AI Campaign — conversational editing (Phase 4) ──────────────────────
  // Claude never runs in the browser: these calls only ever reach the Odito
  // backend, which owns the actual Claude call, validation, and the atomic
  // apply-on-accept. The browser only ever sees a structured proposal.

  /** POST .../drafts/:draftId/assistant — ask Claude to propose changes. */
  async generateAiCampaignProposal(draftId, instruction) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/assistant`, {
      method: 'POST',
      body: JSON.stringify({ instruction }),
    });
  }

  /** GET .../drafts/:draftId/proposals — recent proposals for this draft, newest first. */
  async getAiCampaignProposals(draftId, { limit = 20 } = {}) {
    const params = new URLSearchParams({ limit: String(limit) });
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/proposals?${params.toString()}`);
  }

  /** GET .../drafts/:draftId/proposals/:proposalId */
  async getAiCampaignProposal(draftId, proposalId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/proposals/${proposalId}`);
  }

  /** POST .../proposals/:proposalId/accept — atomic, revision-checked apply. */
  async acceptAiCampaignProposal(draftId, proposalId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/proposals/${proposalId}/accept`, { method: 'POST' });
  }

  /** POST .../proposals/:proposalId/reject — discards the proposal, draft untouched. */
  async rejectAiCampaignProposal(draftId, proposalId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/proposals/${proposalId}/reject`, { method: 'POST' });
  }

  // ── AI Campaign — pre-publish readiness validation (Phase 5) ───────────
  // Read-only from the browser's point of view: this never mutates Google
  // Ads and never publishes anything — it only checks whether the draft, as
  // currently saved, is complete enough to publish later (Phase 6).

  /** POST .../drafts/:draftId/validate — run readiness validation now and persist the result. */
  async runAiCampaignValidation(draftId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/validate`, { method: 'POST' });
  }

  /** GET .../drafts/:draftId/validation — the most recent validation result, without re-running it. */
  async getAiCampaignValidation(draftId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/validation`);
  }

  // ── AI Campaign — Google Ads publish pipeline (Phase 6) ─────────────────
  // The browser never talks to Google Ads and never constructs a mutation
  // payload — this call carries no body at all; every publish decision
  // (readiness, account resolution, plan, mutation) happens server-side.

  /** POST .../drafts/:draftId/publish — publish this campaign to the connected Google Ads account. */
  async publishAiCampaignDraft(draftId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/publish`, { method: 'POST' });
  }

  /** GET .../drafts/:draftId/publish — the latest publish attempt's status, without publishing anything. */
  async getAiCampaignPublishStatus(draftId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/publish`);
  }

  // ── AI Campaign — performance + AI optimization (Phase 7) ───────────────
  // Only for a PUBLISHED campaign. The browser never calls Google Ads and
  // never constructs a mutation payload — approve/reject carry no body;
  // `targets` on analyze() is the one legitimate body field (explicitly
  // user-supplied business targets, never invented — spec §11).

  /** POST .../optimization/analyze — read performance, detect opportunities, generate AI recommendations. */
  async analyzeAiCampaignOptimization(draftId, { range, startDate, endDate, targets } = {}) {
    const params = new URLSearchParams();
    if (range) params.set('range', range);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const qs = params.toString();
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/optimization/analyze${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(targets && Object.keys(targets).length ? { targets } : {}),
    });
  }

  /** GET .../optimization/analysis — the latest persisted opportunities/recommendations, without re-running detection. */
  async getAiCampaignOptimizationAnalysis(draftId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/optimization/analysis`);
  }

  /** POST .../recommendations/:id/approve — re-validate current Google Ads state and execute. */
  async approveAiCampaignOptimizationRecommendation(draftId, recommendationId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/optimization/recommendations/${recommendationId}/approve`, { method: 'POST' });
  }

  /** POST .../recommendations/:id/reject — discard the recommendation, nothing executes. */
  async rejectAiCampaignOptimizationRecommendation(draftId, recommendationId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/optimization/recommendations/${recommendationId}/reject`, { method: 'POST' });
  }

  /** GET .../optimization/history — the audit trail of executed optimizations. */
  async getAiCampaignOptimizationHistory(draftId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/optimization/history`);
  }

  // ── AI Campaign — automation & autonomous optimization controls (Phase 8) ─
  // Structured policy CRUD only — the browser sends a closed set of fields
  // (rules/limits/schedule as plain objects the form assembles field-by-
  // field), never free-form JSON/code/GAQL. Preview and history are
  // read-only: preview creates nothing, history never accepts a body.

  /** POST .../automation/policies — create a new (disabled, observe-mode) policy. */
  async createAiCampaignAutomationPolicy(draftId, payload) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/automation/policies`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /** GET .../automation/policies — every policy configured for this draft. */
  async listAiCampaignAutomationPolicies(draftId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/automation/policies`);
  }

  /** GET .../automation/policies/:id */
  async getAiCampaignAutomationPolicy(draftId, policyId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/automation/policies/${policyId}`);
  }

  /** PATCH .../automation/policies/:id — structural edit (rules/limits/schedule/name). Never changes enabled/mode. */
  async updateAiCampaignAutomationPolicy(draftId, policyId, patch) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/automation/policies/${policyId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  /** DELETE .../automation/policies/:id */
  async deleteAiCampaignAutomationPolicy(draftId, policyId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/automation/policies/${policyId}`, { method: 'DELETE' });
  }

  /** POST .../enable — the explicit "turn this policy on/off" action. */
  async setAiCampaignAutomationPolicyEnabled(draftId, policyId, enabled) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/automation/policies/${policyId}/enable`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  }

  /** POST .../mode — the explicit "switch observe/recommend/execute" action. */
  async setAiCampaignAutomationPolicyMode(draftId, policyId, mode) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/automation/policies/${policyId}/mode`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  }

  /** POST .../preview — read-only "what would this policy do right now". Creates nothing. */
  async previewAiCampaignAutomationPolicy(draftId, policyId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/automation/policies/${policyId}/preview`, { method: 'POST' });
  }

  /** GET .../automation/policies/:id/history — this policy's own run history. */
  async getAiCampaignAutomationPolicyHistory(draftId, policyId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/automation/policies/${policyId}/history`);
  }

  /** GET .../automation/history — every automation run for this draft, across all its policies. */
  async getAiCampaignAutomationHistory(draftId) {
    return this.request(`/google-ads/ai-campaigns/drafts/${draftId}/automation/history`);
  }

}



// Create and export a singleton instance

const apiService = new ApiService();

export default apiService;

