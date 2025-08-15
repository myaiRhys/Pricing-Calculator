const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema({
  // Quote Identification
  quoteNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  quoteName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'],
    default: 'draft'
  },

  // Customer Information
  customer: {
    companyName: { type: String, required: true, trim: true },
    contactPerson: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    emailAddress: { type: String, required: true, trim: true, lowercase: true },
    vatNumber: { type: String, trim: true },
    companyRegistration: { type: String, trim: true }
  },

  // Project Details
  project: {
    projectName: { type: String, trim: true },
    orderNumber: { type: String, trim: true },
    customerReference: { type: String, trim: true },
    deliveryDate: { type: Date },
    quoteDate: { type: Date, required: true },
    validUntil: { type: Date, required: true }
  },

  // Address Information
  address: {
    billingAddress: { type: String, trim: true },
    deliveryAddress: { type: String, trim: true },
    siteContact: { type: String, trim: true },
    siteContactNumber: { type: String, trim: true },
    specialInstructions: { type: String, trim: true },
    accountManager: { type: String, trim: true }
  },

  // Shadecloth Details
  shadecloth: {
    quantity: { type: Number, default: 0, min: 0 },
    width: { type: Number, default: 1.8, min: 0 },
    description: { type: String, default: '80% blue shadenet' },
    unitPrice: { type: Number, default: 1850 }
  },

  // Printing Items
  item1: {
    description: { type: String, trim: true },
    size: { type: String, enum: ['Small', 'Medium', 'Large', 'XLarge'] },
    coverage: { type: String, enum: ['Low', 'Medium', 'High', 'Full'] },
    colors: { type: String, enum: ['1', '2', '3', '4', '5'] },
    printWidth: { type: Number, min: 0 },
    printHeight: { type: Number, min: 0 },
    totalQty: { type: Number, default: 0, min: 0 },
    printsPerRoll: { type: Number, default: 1, min: 1 },
    alternate: { type: Boolean, default: false },
    pattern: { type: String, default: '1:1' }
  },

  item2: {
    description: { type: String, trim: true },
    size: { type: String, enum: ['Small', 'Medium', 'Large', 'XLarge'] },
    coverage: { type: String, enum: ['Low', 'Medium', 'High', 'Full'] },
    colors: { type: String, enum: ['1', '2', '3', '4', '5'] },
    printWidth: { type: Number, min: 0 },
    printHeight: { type: Number, min: 0 },
    totalQty: { type: Number, default: 0, min: 0 },
    printsPerRoll: { type: Number, default: 1, min: 1 },
    alternate: { type: Boolean, default: false },
    pattern: { type: String, default: '1:1' }
  },

  // Setup and Configuration
  setup: {
    waiveSetupFee: { type: Boolean, default: false },
    manualScreenCount: { type: Number, default: 0, min: 0 }
  },

  // Calculations (stored for historical accuracy)
  calculations: {
    item1: {
      unitPrice: { type: Number, default: 0 },
      lineTotal: { type: Number, default: 0 },
      rollsRequired: { type: Number, default: 0 }
    },
    item2: {
      unitPrice: { type: Number, default: 0 },
      lineTotal: { type: Number, default: 0 },
      rollsRequired: { type: Number, default: 0 }
    },
    shadecloth: {
      lineTotal: { type: Number, default: 0 }
    },
    setupFee: {
      screenCount: { type: Number, default: 0 },
      unitPrice: { type: Number, default: 1850 },
      total: { type: Number, default: 0 }
    },
    volumeDiscount: {
      rate: { type: Number, default: 0 },
      amount: { type: Number, default: 0 }
    },
    totals: {
      subtotal: { type: Number, default: 0 },
      vat: { type: Number, default: 0 },
      grandTotal: { type: Number, default: 0 },
      deposit: { type: Number, default: 0 },
      balance: { type: Number, default: 0 }
    }
  },

  // Metadata
  createdBy: {
    type: String,
    default: 'system'
  },
  lastModifiedBy: {
    type: String,
    default: 'system'
  },
  tags: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
quoteSchema.index({ 'customer.companyName': 1 });
quoteSchema.index({ 'project.quoteDate': -1 });
quoteSchema.index({ status: 1 });
quoteSchema.index({ createdAt: -1 });

// Virtual for quote age
quoteSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to generate quote number
quoteSchema.pre('save', async function(next) {
  if (this.isNew && !this.quoteNumber) {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    this.quoteNumber = `PSS-Q-${year}-${timestamp}`;
  }
  next();
});

// Static method to find recent quotes
quoteSchema.statics.findRecent = function(limit = 10) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('quoteNumber quoteName customer.companyName project.quoteDate calculations.totals.grandTotal status createdAt');
};

// Instance method to check if quote is expired
quoteSchema.methods.isExpired = function() {
  return this.project.validUntil < new Date();
};

module.exports = mongoose.model('Quote', quoteSchema);