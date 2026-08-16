import { getTerms } from '../../controllers/glossaryController.js';
import GlossaryTerm from '../../models/glossaryTermModel.js';

// Mock the Mongoose model
jest.mock('../../models/glossaryTermModel.js');

describe('glossaryController.getTerms (Pagination)', () => {
  let req, res;
  
  // Create a mock chain for Mongoose queries: find().sort().skip().limit().exec()
  const mockExec = jest.fn();
  const mockLimit = jest.fn().mockReturnValue({ exec: mockExec });
  const mockSkip = jest.fn().mockReturnValue({ limit: mockLimit });
  const mockSort = jest.fn().mockReturnValue({ skip: mockSkip });

  beforeEach(() => {
    req = {
      user: { organization: 'org123' },
      query: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();

    GlossaryTerm.find.mockReturnValue({ sort: mockSort });
    GlossaryTerm.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(45) });
    mockExec.mockResolvedValue([{ term: 'Test' }]);
  });

  it('should apply default pagination when no parameters are provided', async () => {
    await getTerms(req, res);

    expect(GlossaryTerm.find).toHaveBeenCalledWith({ organization: 'org123' });
    expect(mockSkip).toHaveBeenCalledWith(0); // (page 1 - 1) * 20
    expect(mockLimit).toHaveBeenCalledWith(20); // default limit
    
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      meta: { total: 45, page: 1, limit: 20, totalPages: 3 }
    }));
  });

  it('should respect custom valid page and limit parameters', async () => {
    req.query = { page: '2', limit: '10' };
    await getTerms(req, res);

    expect(mockSkip).toHaveBeenCalledWith(10); // (page 2 - 1) * 10
    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it('should clamp excessively large limits to the maximum allowed limit', async () => {
    req.query = { limit: '500' };
    await getTerms(req, res);

    expect(mockLimit).toHaveBeenCalledWith(100); // Clamped to MAX_LIMIT
  });

  it('should fallback to safe defaults for invalid/negative pagination parameters', async () => {
    req.query = { page: 'invalid', limit: '-5' };
    await getTerms(req, res);

    expect(mockSkip).toHaveBeenCalledWith(0);
    expect(mockLimit).toHaveBeenCalledWith(20);
  });

  it('should preserve existing search filters alongside pagination', async () => {
    req.query = { search: 'API', page: '1', limit: '5' };
    await getTerms(req, res);

    expect(GlossaryTerm.find).toHaveBeenCalledWith({
      organization: 'org123',
      $text: { $search: 'API' }
    });
    expect(mockLimit).toHaveBeenCalledWith(5);
  });
});
