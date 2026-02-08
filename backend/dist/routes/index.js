"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_js_1 = __importDefault(require("./auth.routes.js"));
const organization_routes_js_1 = __importDefault(require("./organization.routes.js"));
const clinic_routes_js_1 = __importDefault(require("./clinic.routes.js"));
const patient_routes_js_1 = __importDefault(require("./patient.routes.js"));
const appointment_routes_js_1 = __importDefault(require("./appointment.routes.js"));
const user_routes_js_1 = __importDefault(require("./user.routes.js"));
const staff_routes_js_1 = __importDefault(require("./staff.routes.js"));
const clinical_record_routes_js_1 = __importDefault(require("./clinical-record.routes.js"));
const radiograph_routes_js_1 = __importDefault(require("./radiograph.routes.js"));
const odontogram_routes_js_1 = __importDefault(require("./odontogram.routes.js"));
const notification_routes_js_1 = __importDefault(require("./notification.routes.js"));
const sms_routes_js_1 = __importDefault(require("./sms.routes.js"));
const rating_routes_js_1 = __importDefault(require("./rating.routes.js"));
const stock_routes_js_1 = __importDefault(require("./stock.routes.js"));
const router = (0, express_1.Router)();
// Health check
router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// API version
router.get('/', (_req, res) => {
    res.json({
        name: 'Dental ERP API',
        version: '1.0.0',
        docs: '/api/v1/docs',
    });
});
// Mount routes
router.use('/auth', auth_routes_js_1.default);
router.use('/organizations', organization_routes_js_1.default);
router.use('/clinics', clinic_routes_js_1.default);
router.use('/patients', patient_routes_js_1.default);
router.use('/appointments', appointment_routes_js_1.default);
router.use('/users', user_routes_js_1.default);
router.use('/staff', staff_routes_js_1.default);
router.use('/clinical-records', clinical_record_routes_js_1.default);
router.use('/radiographs', radiograph_routes_js_1.default);
router.use('/odontogram', odontogram_routes_js_1.default);
router.use('/notifications', notification_routes_js_1.default);
router.use('/sms', sms_routes_js_1.default);
router.use('/ratings', rating_routes_js_1.default);
router.use('/stock', stock_routes_js_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map