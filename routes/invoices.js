const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Quote = require('../models/Quote');

// GET /api/invoices - Get all invoices with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = {};
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus;
    }
    
    if (req.query.company) {
      filter['customer.companyName'] = { $regex: req.query.company, $options: 'i' };
    }
    
    if (req.query.search) {
      filter.$or = [
        { invoiceNumber: { $regex: req.query.search, $options: 'i' } },
        { quoteNumber: { $regex: req.query.search, $options: 'i' } },
        { 'customer.companyName': { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    // Date range filter
    if (req.query.dateFrom || req.query.dateTo) {
      filter['dates.invoiceDate'] = {};
      if (req.query.dateFrom) {
        filter['dates.invoiceDate'].$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        filter['dates.invoiceDate'].$lte = new Date(req.query.dateTo);
      }
    }
    
    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('invoiceNumber quoteNumber customer dates.invoiceDate dates.dueDate totals paymentStatus status createdAt daysOverdue');
    
    const total = await Invoice.countDocuments(filter);
    
    res.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET /api/invoices/recent - Get recent invoices
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const invoices = await Invoice.findRecent(limit);
    res.json(invoices);
  } catch (error) {
    console.error('Error fetching recent invoices:', error);
    res.status(500).json({ error: 'Failed to fetch recent invoices' });
  }
});

// GET /api/invoices/overdue - Get overdue invoices
router.get('/overdue', async (req, res) => {
  try {
    const invoices = await Invoice.findOverdue();
    res.json(invoices);
  } catch (error) {
    console.error('Error fetching overdue invoices:', error);
    res.status(500).json({ error: 'Failed to fetch overdue invoices' });
  }
});

// GET /api/invoices/stats - Get invoice statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await Invoice.aggregate([
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalValue: { $sum: '$totals.grandTotal' },
          totalOutstanding: { $sum: '$totals.amountDue' }
        }
      }
    ]);
    
    const totalInvoices = await Invoice.countDocuments();
    const overdueInvoices = await Invoice.countDocuments({
      paymentStatus: { $in: ['pending', 'partial'] },
      'dates.dueDate': { $lt: new Date() }
    });
    
    const totalRevenue = await Invoice.aggregate([
      { $group: { _id: null, total: { $sum: '$totals.amountPaid' } } }
    ]);
    
    res.json({
      totalInvoices,
      overdueInvoices,
      totalRevenue: totalRevenue[0]?.total || 0,
      paymentStatusBreakdown: stats
    });
  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    res.status(500).json({ error: 'Failed to fetch invoice statistics' });
  }
});

// GET /api/invoices/:id - Get specific invoice
router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('quoteReference');
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// POST /api/invoices - Create new invoice
router.post('/', async (req, res) => {
  try {
    const invoiceData = req.body;
    
    // Validate required fields
    if (!invoiceData.customer?.companyName || !invoiceData.totals?.grandTotal) {
      return res.status(400).json({ 
        error: 'Missing required fields: customer.companyName, totals.grandTotal' 
      });
    }
    
    // Set default dates if not provided
    if (!invoiceData.dates?.invoiceDate) {
      invoiceData.dates = invoiceData.dates || {};
      invoiceData.dates.invoiceDate = new Date();
    }
    
    if (!invoiceData.dates?.dueDate) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // 30 days payment terms
      invoiceData.dates.dueDate = dueDate;
    }
    
    const invoice = new Invoice(invoiceData);
    await invoice.save();
    
    res.status(201).json({
      message: 'Invoice created successfully',
      invoice: invoice
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Validation Error',
        details: error.message 
      });
    }
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// POST /api/invoices/from-quote/:quoteId - Create invoice from quote
router.post('/from-quote/:quoteId', async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.quoteId);
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Convert quote to invoice data
    const invoiceData = {
      quoteReference: quote._id,
      quoteNumber: quote.quoteNumber,
      customer: quote.customer,
      project: quote.project,
      address: quote.address,
      dates: {
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      },
      lineItems: [],
      totals: quote.calculations.totals
    };
    
    // Convert quote items to line items
    if (quote.shadecloth.quantity > 0) {
      invoiceData.lineItems.push({
        description: `${quote.shadecloth.quantity} x ${quote.shadecloth.width}m x 50m rolls of ${quote.shadecloth.description}`,
        quantity: quote.shadecloth.quantity,
        unitPrice: quote.shadecloth.unitPrice,
        lineTotal: quote.calculations.shadecloth.lineTotal,
        category: 'shadenet'
      });
    }
    
    if (quote.item1.description && quote.calculations.item1.lineTotal > 0) {
      invoiceData.lineItems.push({
        description: `${quote.item1.description} - ${quote.item1.totalQty} prints`,
        quantity: quote.item1.totalQty,
        unitPrice: quote.calculations.item1.unitPrice,
        lineTotal: quote.calculations.item1.lineTotal,
        category: 'printing'
      });
    }
    
    if (quote.item2.description && quote.calculations.item2.lineTotal > 0) {
      invoiceData.lineItems.push({
        description: `${quote.item2.description} - ${quote.item2.totalQty} prints`,
        quantity: quote.item2.totalQty,
        unitPrice: quote.calculations.item2.unitPrice,
        lineTotal: quote.calculations.item2.lineTotal,
        category: 'printing'
      });
    }
    
    if (quote.calculations.setupFee.total > 0) {
      invoiceData.lineItems.push({
        description: `Setup & Screen Costs (${quote.calculations.setupFee.screenCount} screens)`,
        quantity: quote.calculations.setupFee.screenCount,
        unitPrice: quote.calculations.setupFee.unitPrice,
        lineTotal: quote.calculations.setupFee.total,
        category: 'setup'
      });
    }
    
    if (quote.calculations.volumeDiscount.amount < 0) {
      invoiceData.lineItems.push({
        description: `Volume Discount (${Math.round(quote.calculations.volumeDiscount.rate * 100)}%)`,
        quantity: 1,
        unitPrice: quote.calculations.volumeDiscount.amount,
        lineTotal: quote.calculations.volumeDiscount.amount,
        category: 'discount'
      });
    }
    
    const invoice = new Invoice(invoiceData);
    await invoice.save();
    
    // Update quote status to accepted
    quote.status = 'accepted';
    await quote.save();
    
    res.status(201).json({
      message: 'Invoice created from quote successfully',
      invoice: invoice
    });
  } catch (error) {
    console.error('Error creating invoice from quote:', error);
    res.status(500).json({ error: 'Failed to create invoice from quote' });
  }
});

// PUT /api/invoices/:id - Update invoice
router.put('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    // Update fields
    Object.assign(invoice, req.body);
    invoice.lastModifiedBy = req.body.modifiedBy || 'system';
    
    await invoice.save();
    
    res.json({
      message: 'Invoice updated successfully',
      invoice: invoice
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Validation Error',
        details: error.message 
      });
    }
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// POST /api/invoices/:id/payments - Add payment to invoice
router.post('/:id/payments', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const { amount, method, reference, notes } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }
    
    if (!method) {
      return res.status(400).json({ error: 'Payment method is required' });
    }
    
    const paymentData = {
      date: new Date(),
      amount: parseFloat(amount),
      method,
      reference: reference || '',
      notes: notes || '',
      recordedBy: req.body.recordedBy || 'system'
    };
    
    await invoice.addPayment(paymentData);
    
    res.json({
      message: 'Payment added successfully',
      invoice: invoice
    });
  } catch (error) {
    console.error('Error adding payment:', error);
    res.status(500).json({ error: 'Failed to add payment' });
  }
});

// PATCH /api/invoices/:id/status - Update invoice status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        validStatuses 
      });
    }
    
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        lastModifiedBy: req.body.modifiedBy || 'system'
      },
      { new: true }
    );
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    res.json({
      message: 'Invoice status updated successfully',
      invoice: invoice
    });
  } catch (error) {
    console.error('Error updating invoice status:', error);
    res.status(500).json({ error: 'Failed to update invoice status' });
  }
});

// DELETE /api/invoices/:id - Delete invoice
router.delete('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    res.json({
      message: 'Invoice deleted successfully',
      deletedInvoice: {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber
      }
    });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

// GET /api/invoices/:id/export - Export invoice data
router.get('/:id/export', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const format = req.query.format || 'json';
    
    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.json"`);
      res.setHeader('Content-Type', 'application/json');
      res.json(invoice);
    } else {
      res.status(400).json({ error: 'Unsupported format. Use format=json' });
    }
  } catch (error) {
    console.error('Error exporting invoice:', error);
    res.status(500).json({ error: 'Failed to export invoice' });
  }
});

module.exports = router;