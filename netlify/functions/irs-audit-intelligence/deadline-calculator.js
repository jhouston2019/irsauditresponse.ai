// AUDIT CORE — HIGH RISK — DO NOT MODIFY WITHOUT FULL TEST SUITE
// IRS Audit Deadline Calculator
// Purpose: Calculate critical deadlines and response windows

/**
 * Standard IRS audit deadlines
 */
const AUDIT_DEADLINES = {
  correspondence_audit: {
    standard: 30, // days
    extension_available: true,
    max_extension: 30 // additional days
  },
  office_audit: {
    standard: 30,
    extension_available: true,
    max_extension: 30
  },
  field_audit: {
    standard: 30,
    extension_available: true,
    max_extension: 60
  },
  document_request: {
    standard: 30,
    extension_available: true,
    max_extension: 30
  },
  thirty_day_letter: {
    standard: 30,
    extension_available: false,
    max_extension: 0
  },
  ninety_day_letter: {
    standard: 90,
    extension_available: false,
    max_extension: 0
  }
};

/**
 * Extract deadline from notice
 */
function extractDeadline(letterText, noticeDate) {
  const deadline = {
    noticeDate: noticeDate || extractNoticeDate(letterText),
    responseDeadline: null,
    daysRemaining: null,
    isUrgent: false,
    isCritical: false,
    extensionAvailable: false
  };
  
  // Try to find explicit deadline in text
  const deadlinePatterns = [
    /respond\s+by\s+(\w+\s+\d{1,2},\s+\d{4})/i,
    /due\s+date:\s*(\w+\s+\d{1,2},\s+\d{4})/i,
    /deadline:\s*(\w+\s+\d{1,2},\s+\d{4})/i,
    /(\w+\s+\d{1,2},\s+\d{4})\s+deadline/i
  ];
  
  for (const pattern of deadlinePatterns) {
    const match = letterText.match(pattern);
    if (match) {
      deadline.responseDeadline = new Date(match[1]);
      break;
    }
  }
  
  // If no explicit deadline found, calculate from notice date
  if (!deadline.responseDeadline && deadline.noticeDate) {
    deadline.responseDeadline = calculateDefaultDeadline(deadline.noticeDate);
  }
  
  // Calculate days remaining
  if (deadline.responseDeadline) {
    const today = new Date();
    const timeDiff = deadline.responseDeadline - today;
    deadline.daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    
    // Set urgency flags
    deadline.isUrgent = deadline.daysRemaining <= 14;
    deadline.isCritical = deadline.daysRemaining <= 7;
  }
  
  return deadline;
}

/**
 * Extract notice date from letter
 */
function extractNoticeDate(letterText) {
  const datePatterns = [
    /date:\s*(\w+\s+\d{1,2},\s+\d{4})/i,
    /dated\s+(\w+\s+\d{1,2},\s+\d{4})/i,
    /(\w+\s+\d{1,2},\s+\d{4})/i
  ];
  
  for (const pattern of datePatterns) {
    const match = letterText.match(pattern);
    if (match) {
      const date = new Date(match[1]);
      if (date.getFullYear() >= 2020 && date.getFullYear() <= 2030) {
        return date;
      }
    }
  }
  
  return null;
}

/**
 * Calculate default deadline (30 days from notice)
 */
function calculateDefaultDeadline(noticeDate) {
  const deadline = new Date(noticeDate);
  deadline.setDate(deadline.getDate() + 30);
  return deadline;
}

/**
 * Get deadline information for audit type
 */
function getDeadlineInfo(auditType) {
  return AUDIT_DEADLINES[auditType] || AUDIT_DEADLINES.correspondence_audit;
}

/**
 * Calculate recommended action date (before deadline)
 */
function calculateActionDate(deadline) {
  const actionDate = new Date(deadline.responseDeadline);
  actionDate.setDate(actionDate.getDate() - 7); // Act 7 days before deadline
  
  return {
    actionDate: actionDate,
    bufferDays: 7,
    recommendation: 'Complete response preparation at least 7 days before deadline'
  };
}

/**
 * Format deadline for display
 */
function formatDeadline(deadline) {
  if (!deadline.responseDeadline) {
    return 'Deadline not determined';
  }
  
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  const formatted = deadline.responseDeadline.toLocaleDateString('en-US', options);
  
  let urgencyText = '';
  if (deadline.isCritical) {
    urgencyText = ' (CRITICAL - IMMEDIATE ACTION REQUIRED)';
  } else if (deadline.isUrgent) {
    urgencyText = ' (URGENT)';
  }
  
  return `${formatted}${urgencyText}`;
}

module.exports = {
  extractDeadline,
  getDeadlineInfo,
  calculateActionDate,
  formatDeadline,
  AUDIT_DEADLINES
};

