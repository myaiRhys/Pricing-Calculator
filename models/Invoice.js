const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  // Invoice Identification
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  quoteReference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote',
    index: true
  },
  quoteNumber: {
    type: String,
    index: true
  },
  
  // Invoice Status
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue'],
    default: 'pending'
  },

  // Customer Information (copied from quote for historical accuracy)
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
    deliveryDate: { type: Date }
  },

  // Address Information
  address: {
    billingAddress: { type: String, trim: true },
    deliveryAddress: { type: String, trim: true },
    siteContact: { type: String, trim: true },
    siteContactNumber: { type: String, trim: true },
    accountManager: { type: String, trim: true }
  },

  // Invoice Dates
  dates: {
    invoiceDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, required: true },
    deliveryDate: { type: Date },
    paidDate: { type: Date }
  },

  // Line Items (copied from quote calculations)
  lineItems: [{
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    category: { 
      type: String, 
      enum: ['shadenet', 'printing', 'setup', 'discount'],
      required: true 
    }
  }],

  // Financial Totals
  totals: {
    subtotal: { type: Number, required: true, min: 0 },
    vatAmount: { type: Number, required: true, min: 0 },
    vatRate: { type: Number, default: 0.15 },
    grandTotal: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    amountDue: { type: Number, required: true, min: 0 }
  },

  // Payment Information
  payments: [{
    date: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    method: { 
      type: String, 
      enum: ['cash', 'bank_transfer', 'card', 'cheque', 'eft'],
      required: true 
    },
    reference: { type: String, trim: true },
    notes: { type: String, trim: true },
    recordedBy: { type: String, default: 'system' }
  }],

  // Terms and Conditions
  terms: {
    paymentTerms: { 
      type: String, 
      default: '50% deposit, balance on completion' 
    },
    leadTime: { 
      type: String, 
      default: '10 working days for printing' 
    },
    validityPeriod: { 
      type: String, 
      default: '30 days' 
    }
  },

  // Production Status
  production: {
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'delivered'],
      default: 'pending'
    },
    startDate: { type: Date },
    completionDate: { type: Date },
    deliveryDate: { type: Date },
    notes: { type: String, trim: true }
  },

  // Metadata
  createdBy: { type: String, default: 'system' },
  lastModifiedBy: { type: String, default: 'system' },
  notes: { type: String, trim: true },
  internalNotes: { type: String, trim: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
invoiceSchema.index({ 'customer.companyName': 1 });
invoiceSchema.index({ 'dates.invoiceDate': -1 });
invoiceSchema.index({ 'dates.dueDate': 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ paymentStatus: 1 });
invoiceSchema.index({ createdAt: -1 });

// Virtual for days overdue
invoiceSchema.virtual('daysOverdue').get(function() {
  if (this.paymentStatus === 'paid') return 0;
  const today = new Date();
  const dueDate = this.dates.dueDate;
  if (today > dueDate) {
    return Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Virtual for outstanding balance
invoiceSchema.virtual('outstandingBalance').get(function() {
  return this.totals.grandTotal - this.totals.amountPaid;
});

// Pre-save middleware to generate invoice number
invoiceSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(year, new Date().getMonth(), 1),
        $lt: new Date(year, new Date().getMonth() + 1, 1)
      }
    });
    this.invoiceNumber = `PSS-INV-${year}${month}-${String(count + 1).padStart(4, '0')}`;
  }
  
  // Update amount due
  this.totals.amountDue = this.totals.grandTotal - this.totals.amountPaid;
  
  // Update payment status based on payments
  if (this.totals.amountPaid === 0) {
    this.paymentStatus = 'pending';
  } else if (this.totals.amountPaid >= this.totals.grandTotal) {
    this.paymentStatus = 'paid';
    if (!this.dates.paidDate) {
      this.dates.paidDate = new Date();
    }
  } else {
    this.paymentStatus = 'partial';
  }
  
  // Check if overdue
  if (this.paymentStatus !== 'paid' && this.dates.dueDate < new Date()) {
    this.paymentStatus = 'overdue';
  }
  
  next();
});

// Static method to find overdue invoices
invoiceSchema.statics.findOverdue = function() {
  return this.find({
    paymentStatus: { $in: ['pending', 'partial'] },
    'dates.dueDate': { $lt: new Date() }
  }).sort({ 'dates.dueDate': 1 });
};

// Static method to find recent invoices
invoiceSchema.statics.findRecent = function(limit = 10) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('invoiceNumber customer.companyName dates.invoiceDate totals.grandTotal paymentStatus status createdAt');
};

// Instance method to add payment
invoiceSchema.methods.addPayment = function(paymentData) {
  this.payments.push(paymentData);
  this.totals.amountPaid = this.payments.reduce((sum, payment) => sum + payment.amount, 0);
  return this.save();
};

module.exports = mongoose.model('Invoice', invoiceSchema);