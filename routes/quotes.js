const express = require('express');
const router = express.Router();
const Quote = require('../models/Quote');

// GET /api/quotes - Get all quotes with pagination and filtering
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
    
    if (req.query.company) {
      filter['customer.companyName'] = { $regex: req.query.company, $options: 'i' };
    }
    
    if (req.query.search) {
      filter.$or = [
        { quoteName: { $regex: req.query.search, $options: 'i' } },
        { quoteNumber: { $regex: req.query.search, $options: 'i' } },
        { 'customer.companyName': { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    // Date range filter
    if (req.query.dateFrom || req.query.dateTo) {
      filter['project.quoteDate'] = {};
      if (req.query.dateFrom) {
        filter['project.quoteDate'].$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        filter['project.quoteDate'].$lte = new Date(req.query.dateTo);
      }
    }
    
    const quotes = await Quote.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('quoteNumber quoteName customer project.quoteDate calculations.totals.grandTotal status createdAt updatedAt ageInDays');
    
    const total = await Quote.countDocuments(filter);
    
    res.json({
      quotes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

// GET /api/quotes/recent - Get recent quotes
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const quotes = await Quote.findRecent(limit);
    res.json(quotes);
  } catch (error) {
    console.error('Error fetching recent quotes:', error);
    res.status(500).json({ error: 'Failed to fetch recent quotes' });
  }
});

// GET /api/quotes/stats - Get quote statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await Quote.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$calculations.totals.grandTotal' }
        }
      }
    ]);
    
    const totalQuotes = await Quote.countDocuments();
    const expiredQuotes = await Quote.countDocuments({
      'project.validUntil': { $lt: new Date() },
      status: { $nin: ['accepted', 'rejected'] }
    });
    
    res.json({
      totalQuotes,
      expiredQuotes,
      statusBreakdown: stats
    });
  } catch (error) {
    console.error('Error fetching quote stats:', error);
    res.status(500).json({ error: 'Failed to fetch quote statistics' });
  }
});

// GET /api/quotes/:id - Get specific quote
router.get('/:id', async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    res.json(quote);
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

// POST /api/quotes - Create new quote
router.post('/', async (req, res) => {
  try {
    const quoteData = req.body;
    
    // Validate required fields
    if (!quoteData.quoteName || !quoteData.customer?.companyName || !quoteData.customer?.contactPerson) {
      return res.status(400).json({ 
        error: 'Missing required fields: quoteName, customer.companyName, customer.contactPerson' 
      });
    }
    
    // Set default dates if not provided
    if (!quoteData.project?.quoteDate) {
      quoteData.project = quoteData.project || {};
      quoteData.project.quoteDate = new Date();
    }
    
    if (!quoteData.project?.validUntil) {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30);
      quoteData.project.validUntil = validUntil;
    }
    
    const quote = new Quote(quoteData);
    await quote.save();
    
    res.status(201).json({
      message: 'Quote created successfully',
      quote: quote
    });
  } catch (error) {
    console.error('Error creating quote:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Validation Error',
        details: error.message 
      });
    }
    res.status(500).json({ error: 'Failed to create quote' });
  }
});

// PUT /api/quotes/:id - Update quote
router.put('/:id', async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Update fields
    Object.assign(quote, req.body);
    quote.lastModifiedBy = req.body.modifiedBy || 'system';
    
    await quote.save();
    
    res.json({
      message: 'Quote updated successfully',
      quote: quote
    });
  } catch (error) {
    console.error('Error updating quote:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Validation Error',
        details: error.message 
      });
    }
    res.status(500).json({ error: 'Failed to update quote' });
  }
});

// PATCH /api/quotes/:id/status - Update quote status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        validStatuses 
      });
    }
    
    const quote = await Quote.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        lastModifiedBy: req.body.modifiedBy || 'system'
      },
      { new: true }
    );
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    res.json({
      message: 'Quote status updated successfully',
      quote: quote
    });
  } catch (error) {
    console.error('Error updating quote status:', error);
    res.status(500).json({ error: 'Failed to update quote status' });
  }
});

// DELETE /api/quotes/:id - Delete quote
router.delete('/:id', async (req, res) => {
  try {
    const quote = await Quote.findByIdAndDelete(req.params.id);
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    res.json({
      message: 'Quote deleted successfully',
      deletedQuote: {
        id: quote._id,
        quoteNumber: quote.quoteNumber,
        quoteName: quote.quoteName
      }
    });
  } catch (error) {
    console.error('Error deleting quote:', error);
    res.status(500).json({ error: 'Failed to delete quote' });
  }
});

// POST /api/quotes/:id/duplicate - Duplicate quote
router.post('/:id/duplicate', async (req, res) => {
  try {
    const originalQuote = await Quote.findById(req.params.id);
    if (!originalQuote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Create new quote data
    const newQuoteData = originalQuote.toObject();
    delete newQuoteData._id;
    delete newQuoteData.quoteNumber;
    delete newQuoteData.createdAt;
    delete newQuoteData.updatedAt;
    
    // Update quote name and dates
    newQuoteData.quoteName = `${originalQuote.quoteName} (Copy)`;
    newQuoteData.project.quoteDate = new Date();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);
    newQuoteData.project.validUntil = validUntil;
    newQuoteData.status = 'draft';
    
    const newQuote = new Quote(newQuoteData);
    await newQuote.save();
    
    res.status(201).json({
      message: 'Quote duplicated successfully',
      quote: newQuote
    });
  } catch (error) {
    console.error('Error duplicating quote:', error);
    res.status(500).json({ error: 'Failed to duplicate quote' });
  }
});

// GET /api/quotes/:id/export - Export quote data
router.get('/:id/export', async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    const format = req.query.format || 'json';
    
    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="quote-${quote.quoteNumber}.json"`);
      res.setHeader('Content-Type', 'application/json');
      res.json(quote);
    } else {
      res.status(400).json({ error: 'Unsupported format. Use format=json' });
    }
  } catch (error) {
    console.error('Error exporting quote:', error);
    res.status(500).json({ error: 'Failed to export quote' });
  }
});

module.exports = router;