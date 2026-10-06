'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useRequireRole } from '@/hooks/useRequireRole';
import OrganiserShell from '@/components/OrganiserShell';
import {
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  createVariant,
  updateVariant,
  deleteVariant,
  ApiError,
} from '@/lib/api';
import { ArrowLeft, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Save, X } from 'lucide-react';

const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'essay', label: 'Essay' },
  { value: 'numeric', label: 'Numeric' },
];

export default function QuestionsPage() {
  const { user, checking } = useRequireRole('organiser');
  const { getToken } = useAuth();
  const params = useParams();
  const router = useRouter();
  const paperId = params.paperId;

  const [questions, setQuestions] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [expandedQuestionId, setExpandedQuestionId] = useState(null);

  // Create/Edit question form state
  const [showForm, setShowForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [formData, setFormData] = useState({
    number: '',
    text: '',
    type: 'short_answer',
    marks: '',
    memoAnswer: '',
  });
  const [formStatus, setFormStatus] = useState('idle');
  const [formError, setFormError] = useState('');

  // Variant management state
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState(null);
  const [variantData, setVariantData] = useState({
    label: '',
    text: '',
    memoAnswer: '',
  });
  const [variantStatus, setVariantStatus] = useState('idle');
  const [variantError, setVariantError] = useState('');

  const loadQuestions = useCallback(async () => {
    try {
      setStatus('loading');
      const token = await getToken();
      const data = await listQuestions(paperId, token);
      setQuestions(data);
      setStatus('idle');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }, [paperId, getToken]);

  useEffect(() => {
    if (!paperId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadQuestions();
  }, [paperId, loadQuestions]);

  function resetForm() {
    setFormData({
      number: '',
      text: '',
      type: 'short_answer',
      marks: '',
      memoAnswer: '',
    });
    setEditingQuestionId(null);
    setShowForm(false);
    setFormError('');
  }

  function startEdit(question) {
    setFormData({
      number: question.number,
      text: question.text,
      type: question.type,
      marks: question.marks,
      memoAnswer: question.memoAnswer || '',
    });
    setEditingQuestionId(question.id);
    setShowForm(true);
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setFormStatus('saving');
      const token = await getToken();
      const payload = {
        number: parseInt(formData.number),
        text: formData.text,
        type: formData.type,
        marks: parseFloat(formData.marks),
        memoAnswer: formData.memoAnswer || null,
      };

      if (editingQuestionId) {
        await updateQuestion(editingQuestionId, payload, token);
      } else {
        await createQuestion(paperId, payload, token);
      }

      await loadQuestions();
      resetForm();
      setFormStatus('idle');
    } catch (err) {
      setFormError(err.message);
      setFormStatus('error');
    }
  }

  async function handleDelete(questionId) {
    if (!confirm('Delete this question and all its variants?')) return;
    try {
      const token = await getToken();
      await deleteQuestion(questionId, token);
      await loadQuestions();
    } catch (err) {
      setError(err.message);
    }
  }

  function resetVariantForm() {
    setVariantData({ label: '', text: '', memoAnswer: '' });
    setEditingVariantId(null);
    setShowVariantForm(false);
    setVariantError('');
  }

  function startVariantEdit(variant) {
    setVariantData({
      label: variant.label,
      text: variant.text || '',
      memoAnswer: variant.memoAnswer || '',
    });
    setEditingVariantId(variant.id);
    setShowVariantForm(true);
    setVariantError('');
  }

  async function handleVariantSubmit(e) {
    e.preventDefault();
    if (!expandedQuestionId) return;

    try {
      setVariantStatus('saving');
      const token = await getToken();
      const payload = {
        label: variantData.label,
        text: variantData.text || null,
        memoAnswer: variantData.memoAnswer || null,
      };

      if (editingVariantId) {
        await updateVariant(editingVariantId, payload, token);
      } else {
        await createVariant(expandedQuestionId, payload, token);
      }

      await loadQuestions();
      resetVariantForm();
      setVariantStatus('idle');
    } catch (err) {
      setVariantError(err.message);
      setVariantStatus('error');
    }
  }

  async function handleDeleteVariant(variantId) {
    if (!confirm('Delete this variant?')) return;
    try {
      const token = await getToken();
      await deleteVariant(variantId, token);
      await loadQuestions();
    } catch (err) {
      setError(err.message);
    }
  }

  if (checking) return null;
  if (!user) return null;

  return (
    <OrganiserShell>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Questions</h1>
            <p className="text-gray-600 mt-1">Manage questions and variants for this paper</p>
          </div>
          {!showForm && (
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
            >
              <Plus size={18} />
              Add Question
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {status === 'loading' && (
          <div className="text-center py-12 text-gray-500">Loading questions...</div>
        )}

        {status === 'idle' && questions.length === 0 && !showForm && (
          <div className="text-center py-12 text-gray-500">
            No questions yet. Click &ldquo;Add Question&rdquo; to create one.
          </div>
        )}

        {/* Create/Edit Question Form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingQuestionId ? 'Edit Question' : 'New Question'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Question Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marks</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={formData.marks}
                    onChange={(e) => setFormData({ ...formData, marks: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Question Type
                </label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Question Text
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Memo Answer (for auto-marking)
                </label>
                <input
                  type="text"
                  value={formData.memoAnswer}
                  onChange={(e) => setFormData({ ...formData, memoAnswer: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="Optional correct answer"
                />
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-sm">
                  {formError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={formStatus === 'saving'}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                >
                  <Save size={16} />
                  {formStatus === 'saving' ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  <X size={16} />
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Questions List */}
        <div className="space-y-4">
          {questions.map((question) => (
            <div
              key={question.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-violet-100 text-violet-700 font-semibold rounded-full text-sm">
                        {question.number}
                      </span>
                      <span className="text-xs font-medium text-gray-500 uppercase">
                        {QUESTION_TYPES.find((t) => t.value === question.type)?.label}
                      </span>
                      <span className="text-sm text-gray-600">{question.marks} marks</span>
                    </div>
                    <p className="text-gray-900 whitespace-pre-wrap">{question.text}</p>
                    {question.memoAnswer && (
                      <p className="text-sm text-gray-600 mt-2">
                        <span className="font-medium">Answer:</span> {question.memoAnswer}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => startEdit(question)}
                      className="p-2 text-gray-600 hover:text-violet-600 hover:bg-violet-50 rounded"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(question.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Variants Section */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() =>
                      setExpandedQuestionId(expandedQuestionId === question.id ? null : question.id)
                    }
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    {expandedQuestionId === question.id ? (
                      <ChevronUp size={16} />
                    ) : (
                      <ChevronDown size={16} />
                    )}
                    Variants ({question.variants?.length || 0})
                  </button>

                  {expandedQuestionId === question.id && (
                    <div className="mt-4 space-y-3">
                      {question.variants?.map((variant) => (
                        <div
                          key={variant.id}
                          className="bg-gray-50 border border-gray-200 rounded p-4"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 mb-1">{variant.label}</div>
                              {variant.text && (
                                <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">
                                  {variant.text}
                                </p>
                              )}
                              {variant.memoAnswer && (
                                <p className="text-sm text-gray-600">
                                  <span className="font-medium">Answer:</span> {variant.memoAnswer}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => startVariantEdit(variant)}
                                className="p-1.5 text-gray-600 hover:text-violet-600 hover:bg-violet-50 rounded"
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteVariant(variant.id)}
                                className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {showVariantForm && expandedQuestionId === question.id ? (
                        <div className="bg-white border border-gray-300 rounded p-4">
                          <form onSubmit={handleVariantSubmit} className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Variant Label
                              </label>
                              <input
                                type="text"
                                required
                                value={variantData.label}
                                onChange={(e) =>
                                  setVariantData({ ...variantData, label: e.target.value })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                                placeholder="e.g., Variant A, Version 1"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Question Text (optional)
                              </label>
                              <textarea
                                rows={2}
                                value={variantData.text}
                                onChange={(e) =>
                                  setVariantData({ ...variantData, text: e.target.value })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                                placeholder="Leave blank to use parent question text"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Memo Answer (optional)
                              </label>
                              <input
                                type="text"
                                value={variantData.memoAnswer}
                                onChange={(e) =>
                                  setVariantData({ ...variantData, memoAnswer: e.target.value })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                              />
                            </div>
                            {variantError && (
                              <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-sm">
                                {variantError}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={variantStatus === 'saving'}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50 text-sm"
                              >
                                <Save size={14} />
                                {variantStatus === 'saving' ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={resetVariantForm}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                              >
                                <X size={14} />
                                Cancel
                              </button>
                            </div>
                          </form>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            resetVariantForm();
                            setShowVariantForm(true);
                          }}
                          className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 font-medium"
                        >
                          <Plus size={14} />
                          Add Variant
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </OrganiserShell>
  );
}
