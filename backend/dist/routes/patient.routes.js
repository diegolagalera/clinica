"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const patientController = __importStar(require("../controllers/patient.controller.js"));
const index_js_1 = require("../middleware/index.js");
const router = (0, express_1.Router)();
// All routes require authentication, staff role, and tenant context
router.use(index_js_1.authenticate);
router.use(index_js_1.requireStaff);
router.use(index_js_1.tenantContext);
// List patients
router.get('/', patientController.listPatients);
// Get patient by ID
router.get('/:id', patientController.getPatient);
// Get patient stats
router.get('/:id/stats', patientController.getPatientStats);
// Create patient
router.post('/', patientController.createPatient);
// Update patient
router.put('/:id', patientController.updatePatient);
// Delete patient (soft delete)
router.delete('/:id', patientController.deletePatient);
exports.default = router;
//# sourceMappingURL=patient.routes.js.map