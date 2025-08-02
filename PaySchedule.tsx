import React, { useState, useEffect } from 'react';
import { ComponentsheaderComponent } from '../../../../components/common/componentsheader/componentsheader.component';
import { MainTableComponent } from '../../../../components/common/tableComponents/maincomponent/maintable';
import { TableColumn, TableAction, ACTIONS, ColumnTypes } from '../../../../components/common/tableComponents/models';
import { Button, Modal, Drawer, Form, Input, Select, DatePicker, Card, Row, Col, Typography, Space } from 'antd';
import { useNavigate } from 'react-router';
import { CustomServiceService } from '../../../../hooks/custom-service.service';
import { useAxios } from '../../../../contexts/AxiosContext';
import AlertModalComponent, { ALERT_TYPES } from '../../../../components/common/modals/alertModal/alertModal';
import { IConfirmationModal, ModalConfirmation } from '../../../../components/common/modals/modalConfirmation/ModalConfirmation';
import { ModalsComponent } from '../../../../components/common/modals/modals.component';
import ModalComponent from '../../../../components/common/modals/centeredModal.component';
import EmptyComponent from '../../../../components/common/empty/EmptyComponent';
import { LoadableButtonComponent } from '../../../../components/common/loadableBtn/loadable-button.component';

import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
dayjs.extend(isSameOrAfter);

const { Title, Text } = Typography;
const { Option } = Select;

// Pay Frequency options
const payFrequencies = [
  { value: 1, label: 'Daily' },
  { value: 2, label: 'Weekly' },
  { value: 3, label: 'Bi-Weekly' },
  { value: 4, label: 'Monthly' },
  { value: 5, label: 'Bi-Monthly' },
  { value: 6, label: 'Quarterly' },
  { value: 7, label: 'Bi-Annual' },
  { value: 8, label: 'Annual' },
];

// Pay Period options (from backend enum)
const payPeriods = [
  { value: 1, label: 'Daily' },
  { value: 2, label: 'Weekly' },
  { value: 3, label: 'Bi-Monthly' },
  { value: 4, label: 'Monthly' },
  { value: 5, label: 'Bi-Annual' },
  { value: 6, label: 'Annual' },
];

// Table columns for Pay Schedule - matching API response
const tableColumns: TableColumn[] = [
  { name: 'payScheduleName', title: 'NAME', type: ColumnTypes.Text },
  { name: 'frequency', title: 'PAY FREQUENCY', type: ColumnTypes.Text },
  { name: 'payrollPaymentDate', title: 'PAY DATE', type: ColumnTypes.oDate },
];

// Table actions
const tableActions: TableAction[] = [
  { name: ACTIONS.VIEW, label: 'View' },
  { name: ACTIONS.EDIT, label: 'Edit' },
  { name: ACTIONS.DELETE, label: 'Delete' },
];

// Filter fields
const filterFields: TableColumn[] = [
  {
    name: 'payFrequency',
    title: 'Pay Frequency',
    type: ColumnTypes.List,
    listValue: payFrequencies,
    listIdField: 'value',
    listTextField: 'label',
  },
  {
    name: 'name',
    title: 'Schedule Name',
    type: ColumnTypes.Text,
  },
];

// Helper function to get frequency label
const getFrequencyLabel = (frequency: number) => {
  const frequencyMap: { [key: number]: string } = {
    1: 'Daily',
    2: 'Weekly',
    3: 'Bi-Weekly',
    4: 'Monthly',
    5: 'Bi-Monthly',
    6: 'Quarterly',
    7: 'Bi-Annual',
    8: 'Annual'
  };
  return frequencyMap[frequency] || 'Unknown';
};

// Pay Schedule Form Component
const PayScheduleForm = ({ open, onCancel, paySchedule, onSuccess }: any) => {
  const [form] = Form.useForm();
  const axiosInstance = useAxios();
  const customService = new CustomServiceService(axiosInstance!);
  const [submitting, setSubmitting] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [alertType, setAlertType] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [alertButtonMessage, setAlertButtonMessage] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);

  useEffect(() => {
    if (paySchedule) {
      console.log('Form pre-population - paySchedule data:', paySchedule);
      const formValues = {
        name: paySchedule.payScheduleName,
        payFrequency: paySchedule.frequency,
        dayOfMonth: paySchedule.dayOfTheMonth,
        // CHANGED: Use payrollPaymentDate instead of payrollInitializationDate
        firstPayDate: paySchedule.payrollPaymentDate ? dayjs(paySchedule.payrollPaymentDate) : null,
        deadline: paySchedule.payrollDeadlineDate ? dayjs(paySchedule.payrollDeadlineDate) : null,
        payPeriod: paySchedule.payPeriod || '',
      };
      console.log('Form pre-population - setting form values:', formValues);
      form.setFieldsValue(formValues);
    } else {
      form.resetFields();
    }
  }, [paySchedule, form]);

  // Add this function to handle form validation state
  const handleFieldsChange = () => {
    const hasErrors = form.getFieldsError().some(({ errors }) => errors.length);
    const allTouched = form.isFieldsTouched(true);
    setIsFormValid(!hasErrors && allTouched);
  };

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      if (values.dayOfMonth < 1 || values.dayOfMonth > 31) {
        setAlertType(ALERT_TYPES.FAILED);
        setAlertMsg('Day of the Month must be between 1 and 31.');
        setAlertButtonMessage('OK');
        setOpenModal(true);
        setSubmitting(false);
        return;
      }
      // Only check that Deadline is before First Pay Date
      if (
        values.firstPayDate &&
        values.deadline &&
        !dayjs(values.firstPayDate).isAfter(dayjs(values.deadline))
      ) {
        setAlertType(ALERT_TYPES.FAILED);
        setAlertMsg('First Pay Date must be after Deadline to run Payroll.');
        setAlertButtonMessage('OK');
        setOpenModal(true);
        setSubmitting(false);
           return;
      }
      // Prepare payload for create/update
      const payload: any = {
        payScheduleName: values.name,
        dayOfTheMonth: parseInt(values.dayOfMonth),
        frequency: parseInt(values.payFrequency),
        // REMOVED: payrollInitializationDate
        payrollDeadlineDate: values.deadline?.format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
        payrollPaymentDate: values.firstPayDate?.format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
      };
      // Include payPeriod if present (for future backend support)
      if (values.payPeriod) {
        payload.payPeriod = Number(values.payPeriod);
      }
      if (paySchedule?.id) {
        // Update existing pay schedule
        await customService.updatePaySchedule({ ...payload, id: paySchedule.id });
        setAlertMsg('Pay schedule updated successfully!');
      } else {
         // Create new pay schedule
        await customService.createPaySchedule(payload);
        setAlertMsg('Pay schedule created successfully!');
      }
      setAlertType(ALERT_TYPES.SUCCESS);
      setAlertButtonMessage('OK');
      setOpenModal(true);
      onSuccess && onSuccess();
    } catch (err: any) {
      setAlertType(ALERT_TYPES.FAILED);
      setAlertMsg(err?.message || 'Failed to save pay schedule.');
      setAlertButtonMessage('OK');
      setOpenModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ModalsComponent
        isOpen={open}
        title={paySchedule ? 'Edit Pay Schedule' : 'Create New Pay Schedule'}
        closeBtnClicked={onCancel}
      >
        <div 
          className="w-full p-5 space-y-5"
          style={{
            boxShadow: '0px 4px 25px 0px #0000001A',
            borderRadius: '4px'
          }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            onFieldsChange={handleFieldsChange}
          >
            <Form.Item
              name="name"
              label="Pay Schedule Name"
              rules={[{ required: true, message: 'Please enter pay schedule name' }]}
            >
              <Input 
                placeholder="Enter Name" 
                style={{
                  height: '40px',
                  borderRadius: '4px'
                }}
              />
            </Form.Item>

            <Form.Item
              name="payFrequency"
              label="Pay Frequency"
              rules={[{ required: true, message: 'Please select pay frequency' }]}
            >
              <Select 
                placeholder="Select"
                style={{
                  height: '40px',
                  borderRadius: '4px'
                }}
              >
                {payFrequencies.map(freq => (
                  <Option key={freq.value} value={freq.value}>{freq.label}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="dayOfMonth"
              label="Day of the Month"
              rules={[{ required: true, message: 'Please select day of month' },
                { type: 'number', min: 1, max: 31, message: 'Day must be between 1 and 31' }
              ]}
              getValueFromEvent={value => Number(value)}
            >
              <Select 
                placeholder="Select"
                style={{
                  height: '40px',
                  borderRadius: '4px'
                }}
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <Option key={day} value={day}>{day}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="firstPayDate"
              label="First Pay Date on New Schedule"
              rules={[{ required: true, message: 'Please select first pay date' }]}
            >
              <DatePicker 
                style={{ 
                  width: '100%',
                  height: '40px',
                  borderRadius: '4px'
                }} 
                placeholder="Select" 
              />
            </Form.Item>

            <Form.Item
              name="deadline"
              label="Deadline to run Payroll"
              rules={[{ required: true, message: 'Please select deadline' }]}
            >
              <DatePicker 
                style={{ 
                  width: '100%',
                  height: '40px',
                  borderRadius: '4px'
                }} 
                placeholder="Select" 
              />
            </Form.Item>

            <Form.Item
              name="payPeriod"
              label="Pay Period"
              rules={[{ required: true, message: 'Please select pay period' }]}
            >
              <Select 
                placeholder="Select"
                style={{
                  height: '40px',
                  borderRadius: '4px'
                }}
              >
                {payPeriods.map(period => (
                  <Option key={period.value} value={period.value}>{period.label}</Option>
                ))}
              </Select>
            </Form.Item>

            <div className="flex justify-start space-x-4 pt-4">
              <button
                type="button"
                onClick={onCancel}
                style={{
                  width: '131px',
                  height: '52px',
                  borderRadius: '4px',
                  borderWidth: '1px',
                  borderColor: '#D1D5DB',
                  backgroundColor: '#FFFFFF',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => form.submit()}
                disabled={!isFormValid || submitting}
                style={{
                  width: '131px',
                  height: '52px',
                  borderRadius: '4px',
                  borderWidth: '1px',
                  borderColor: '#4847E0',
                  backgroundColor: '#4847E0',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: !isFormValid || submitting ? 0.5 : 1,
                  cursor: !isFormValid || submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </Form>
        </div>
      </ModalsComponent>

      <AlertModalComponent
        show={openModal}
        alertType={alertType}
        alertMessage={alertMsg}
        alertButtonMessage={alertButtonMessage}
        onClose={() => {
          setOpenModal(false);
          if (alertType === ALERT_TYPES.SUCCESS) {
            onCancel();
          }
        }}
      />
    </>
  );
};

// Assignment Page Component - FIXED VERSION
const AssignmentPage = ({ onBack }: any) => {
  const [selectedOption, setSelectedOption] = useState('all');
  const [showPayScheduleTable, setShowPayScheduleTable] = useState(false);
  const [showEmployeeAssignmentPage, setShowEmployeeAssignmentPage] = useState(false);
  const [showDepartmentAssignmentPage, setShowDepartmentAssignmentPage] = useState(false);
  const [showGrossPayAssignmentPage, setShowGrossPayAssignmentPage] = useState(false);
  const [showCompensationTypeAssignmentPage, setShowCompensationTypeAssignmentPage] = useState(false);
  const [showPayScaleAssignmentPage, setShowPayScaleAssignmentPage] = useState(false);
  const [paySchedules, setPaySchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPaySchedule, setSelectedPaySchedule] = useState<any>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [alertType, setAlertType] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [alertButtonMessage, setAlertButtonMessage] = useState('');
  const [openModal, setOpenModal] = useState(false);
  
  // Enhanced state for better UX
  const [assignmentHistory, setAssignmentHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState<any>({
    payScheduleName: undefined,
    frequency: undefined,
    dayOfTheMonth: undefined,
    pageSize: 10,
    pageNumber: 1,
    version: "1",
  });
  const [appliedFilt, setAppliedFilt] = useState(false);
  const navigate = useNavigate();
  const axiosInstance = useAxios();
  const customService = new CustomServiceService(axiosInstance!);

  const assignmentOptions = [
    {
      id: 'all',
      title: 'Everyone on one Schedule',
      description: 'Choose one pay schedule for all your employees.',
    },
    {
      id: 'compensation',
      title: 'By Compensation Type',
      description: 'Assign different pay schedule to hourly and salaried employees.',
    },
    {
      id: 'employee',
      title: 'By Employee',
      description: 'Assign employee to pay schedules individually. Use this for schedules based on location, owner status, etc.',
    },
    {
      id: 'department',
      title: 'By Department',
      description: 'Assign pay schedule to departments, use this to pay sales or other commissioned department separately.',
    },
    {
      id: 'payscale',
      title: 'By Pay Scale',
      description: 'Assign employee to pay schedule using the payscale.',
    },
    {
      id: 'grosspay',
      title: 'By Gross Pay',
      description: 'Assign employee to pay schedule using the Gross Pay.',
    },
  ];

  // Fetch pay schedules for the table (only called when needed)
  const fetchPaySchedules = async () => {
    setLoading(true);
    try {
      const response = await customService.getAllPaySchedules();
      if (response?.result) {
        setPaySchedules(response.result);
      }
    } catch (error) {
      console.error('Error fetching pay schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (selectedOption === 'all') {
      await fetchPaySchedules();
      setShowPayScheduleTable(true);
    } else if (selectedOption === 'employee') {
      setShowEmployeeAssignmentPage(true);
    } else if (selectedOption === 'department') {
      setShowDepartmentAssignmentPage(true);
    } else if (selectedOption === 'grosspay') {
      setShowGrossPayAssignmentPage(true);
    } else if (selectedOption === 'compensation') {
      setShowCompensationTypeAssignmentPage(true);
    } else if (selectedOption === 'payscale') {
      setShowPayScaleAssignmentPage(true);
    }
  };

  // If showing employee assignment page, render the employee assignment view
  if (showEmployeeAssignmentPage) {
    return <div>Employee Assignment Page (Component would be here)</div>;
  }

  // If showing department assignment page, render the department assignment view
  if (showDepartmentAssignmentPage) {
    return <div>Department Assignment Page (Component would be here)</div>;
  }

  // If showing gross pay assignment page, render the gross pay assignment view
  if (showGrossPayAssignmentPage) {
    return <div>Gross Pay Assignment Page (Component would be here)</div>;
  }

  // If showing compensation type assignment page, render the compensation type assignment view
  if (showCompensationTypeAssignmentPage) {
    return <div>Compensation Type Assignment Page (Component would be here)</div>;
  }

  // If showing pay scale assignment page, render the pay scale assignment view
  if (showPayScaleAssignmentPage) {
    return <div>Pay Scale Assignment Page (Component would be here)</div>;
  }

  // If showing pay schedule table, render the table view
  if (showPayScheduleTable) {
    return (
      <div className="w-full">
        <ComponentsheaderComponent
          showbackbutton={true}
          pageName="Select Pay Schedule"
          backbuttonClick={() => setShowPayScheduleTable(false)}
          requiredButton={[]}
          buttonClick={() => {}}
        />

        <div className="ml-10 mr-6 my-10 p-4 md:p-8 bg-white shadow-md rounded-md">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold mb-2">Select a Pay Schedule for All Employees</h2>
              <p className="text-gray-600">Choose a pay schedule to assign to all employees in your organization.</p>
            </div>
          </div>

          {paySchedules.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-center">
                <div className="text-lg font-semibold mb-4">No Existing Pay Schedule</div>
                <div className="text-sm text-gray-600 mb-6">
                  Get started by creating your first pay schedule
                </div>
                <button
                  onClick={() => onBack()}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                >
                  Go Back to Create Pay Schedule
                </button>
              </div>
            </div>
          ) : (
            <MainTableComponent
              tableColum={[
                { name: "payScheduleName", title: "Pay Schedule Name", type: ColumnTypes.Text },
                { name: "frequency", title: "Frequency", type: ColumnTypes.Text },
                { name: "dayOfTheMonth", title: "Day of Month", type: ColumnTypes.Text },
              ]}
              userData={paySchedules}
              loading={loading}
              actions={[{ name: "select", label: "Select" }]}
              actionClick={(event: { name: string; data: any }) => {
                if (event.name === "select") {
                  // Handle pay schedule selection logic here
                  setAlertType(ALERT_TYPES.SUCCESS);
                  setAlertMsg(`Selected "${event.data.payScheduleName}" for assignment to all employees`);
                  setAlertButtonMessage('OK');
                  setOpenModal(true);
                }
              }}
              actionChecked={() => {}}
              actionBulkChecked={() => {}}
              bulkactionClicked={() => {}}
              filterFields={[]}
              filterChange={() => {}}
              pageChange={() => {}}
              dateRangeChanged={() => {}}
              toggleColumnsEvent={() => {}}
              toggleCustomFilter={() => {}}
              sortOptionSelected={() => {}}
              currentTablePage={1}
              totalItems={paySchedules.length}
              cancelFilter={() => {}}
              showCheckBox={false}
              showActions={true}
              showFilter={false}
              showSortBtn={false}
              showPagination={false}
              showBulkAction={false}
              InputFileName="Pay Schedule Selection"
              appliedFilt={false}
              setAppliedFilt={() => {}}
            />
          )}
        </div>

        {/* Alert Modal */}
        <AlertModalComponent
          show={openModal}
          alertType={alertType}
          alertTitle=""
          closeValue=""
          alertMessage={alertMsg}
          alertButtonMessage={alertButtonMessage}
          onClose={() => {
            setOpenModal(false);
            if (alertType === ALERT_TYPES.SUCCESS) {
              setTimeout(() => {
                onBack(); // Go back to main pay schedule page
              }, 1500);
            }
          }}
        />
      </div>
    );
  }

  // FIXED: Main assignment page - show the assignment option cards FIRST
  return (
    <div className="w-full">
      <ComponentsheaderComponent
        showbackbutton={true}
        pageName="Assign Pay Schedule"
        backbuttonClick={onBack}
        requiredButton={[]}
        buttonClick={() => {}}
      />

      <div className="ml-10 mr-6 my-10 p-4 md:p-8 bg-white shadow-md rounded-md">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-2">How would you like to assign pay schedules?</h2>
          <p className="text-gray-600">Choose an assignment method that works best for your organization.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {assignmentOptions.map((option) => (
            <div
              key={option.id}
              className={`border rounded-lg p-6 cursor-pointer transition-all hover:shadow-md ${
                selectedOption === option.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedOption(option.id)}
            >
              <div className="flex items-start space-x-3">
                <input
                  type="radio"
                  name="assignmentOption"
                  value={option.id}
                  checked={selectedOption === option.id}
                  onChange={() => setSelectedOption(option.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">{option.title}</h3>
                  <p className="text-sm text-gray-600">{option.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedOption}
            className={`px-6 py-2 rounded-md text-white font-medium ${
              selectedOption
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            Continue
          </button>
        </div>
      </div>

      {/* Alert Modal */}
      <AlertModalComponent
        show={openModal}
        alertType={alertType}
        alertMessage={alertMsg}
        alertButtonMessage={alertButtonMessage}
        onClose={() => setOpenModal(false)}
      />
    </div>
  );
};

// Main PaySchedule Component
const PaySchedule: React.FC = () => {
  const navigate = useNavigate();
  const axiosInstance = useAxios();
  const customService = new CustomServiceService(axiosInstance!);
  
  const [paySchedules, setPaySchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [appliedFilt, setAppliedFilt] = useState(false);

  // Modal states
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedPaySchedule, setSelectedPaySchedule] = useState<any>(null);
  const [viewPaySchedule, setViewPaySchedule] = useState<any>(null);
  const [loadingView, setLoadingView] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [alertType, setAlertType] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [alertButtonMessage, setAlertButtonMessage] = useState('');
  const [confirmationModal, setConfirmationModal] = useState<IConfirmationModal>({
    open: false,
    header: '',
    content: '',
    selectedData: null,
    actionButton: [],
  });

  // Page state
  const [currentView, setCurrentView] = useState<'list' | 'assignment'>('list');

  // Fetch pay schedules
  const fetchPaySchedules = async () => {
    setLoading(true);
    try {
      const response = await customService.getAllPaySchedules();
      if (response?.result) {
        setPaySchedules(response.result);
        setTotalItems(response.result.length);
      } else {
        setPaySchedules([]);
        setTotalItems(0);
      }
    } catch (error) {
      console.error('Error fetching pay schedules:', error);
      setPaySchedules([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  };

  // Handle header button clicks
  const handleHeaderButtonClick = (buttonName: string) => {
    if (buttonName === 'addNew') {
      setSelectedPaySchedule(null);
      setFormOpen(true);
    } else if (buttonName === 'assignPaySchedule') {
      setCurrentView('assignment');
    }
  };

  // Handle table actions
  const handleTableAction = async (event: { name: string; data: any }) => {
    const { name, data } = event;
    
    if (name === ACTIONS.VIEW) {
      await handleViewPaySchedule(data.id);
    } else if (name === ACTIONS.EDIT) {
      await handleEditPaySchedule(data.id);
    } else if (name === ACTIONS.DELETE) {
      await handleDeletePaySchedule(data.id);
    }
  };

  // Handle edit pay schedule
  const handleEditPaySchedule = async (id: string) => {
    try {
      const response = await customService.getPayScheduleById(id);
      if (response?.result) {
        setSelectedPaySchedule(response.result);
        setFormOpen(true);
      }
    } catch (error) {
      console.error('Error fetching pay schedule for edit:', error);
    }
  };

  // Handle view pay schedule
  const handleViewPaySchedule = async (id: string) => {
    setLoadingView(true);
    try {
      const response = await customService.getPayScheduleById(id);
      if (response?.result) {
        setViewPaySchedule(response.result);
        setViewOpen(true);
      }
    } catch (error) {
      console.error('Error fetching pay schedule for view:', error);
    } finally {
      setLoadingView(false);
    }
  };

  // Handle delete pay schedule
  const handleDeletePaySchedule = async (id: string) => {
    setConfirmationModal({
      open: true,
      header: 'Confirm Delete',
      content: 'Are you sure you want to delete this pay schedule?',
      selectedData: { id },
      actionButton: [
        {
          title: 'Cancel',
          action: () => setConfirmationModal(prev => ({ ...prev, open: false })),
          loading: false,
        },
        {
          title: 'Delete',
          action: async () => {
            try {
              await customService.deletePaySchedule(id);
              setAlertType(ALERT_TYPES.SUCCESS);
              setAlertMsg('Pay schedule deleted successfully!');
              setAlertButtonMessage('OK');
              setOpenModal(true);
              fetchPaySchedules();
            } catch (error: any) {
              setAlertType(ALERT_TYPES.FAILED);
              setAlertMsg(error?.message || 'Failed to delete pay schedule');
              setAlertButtonMessage('OK');
              setOpenModal(true);
            } finally {
              setConfirmationModal(prev => ({ ...prev, open: false }));
            }
          },
          loading: false,
        },
      ],
    });
  };

  useEffect(() => {
    fetchPaySchedules();
  }, []);

  // If showing assignment page, render the assignment view
  if (currentView === 'assignment') {
    return <AssignmentPage onBack={() => setCurrentView('list')} />;
  }

  return (
    <div className="w-full">
      <ComponentsheaderComponent
        showbackbutton={true}
        pageName="Pay Schedule"
        backbuttonClick={() => navigate(-1)}
        requiredButton={[
          {
            name: 'addNew',
            label: 'Add New',
            outline: false,
            icon: '',
          },
          {
            name: 'assignPaySchedule',
            label: 'Assign Pay Schedule',
            outline: true,
            icon: '',
          },
        ]}
        buttonClick={handleHeaderButtonClick}
      />

      <div className="ml-10 mr-6 my-10 p-4 md:p-8 bg-white shadow-md rounded-md">
        {loading && paySchedules.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : !loading && paySchedules.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <div className="text-lg font-semibold mb-4">No Existing Pay Schedule</div>
              <div className="text-sm text-gray-600 mb-6">
                Get started by creating your first pay schedule
              </div>
              <button
                onClick={() => {
                  setSelectedPaySchedule(null);
                  setFormOpen(true);
                }}
                className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors"
              >
                Create New
              </button>
            </div>
          </div>
        ) : (
          <MainTableComponent
            tableColum={tableColumns}
            userData={paySchedules}
            loading={loading}
            actions={tableActions}
            actionClick={handleTableAction}
            actionChecked={() => {}}
            actionBulkChecked={() => {}}
            bulkactionClicked={() => {}}
            filterFields={filterFields}
            filterChange={() => {}}
            pageChange={() => {}}
            dateRangeChanged={() => {}}
            toggleColumnsEvent={() => {}}
            toggleCustomFilter={() => {}}
            sortOptionSelected={() => {}}
            currentTablePage={currentPage}
            totalItems={totalItems}
            cancelFilter={() => {}}
            showCheckBox={true}
            showActions={true}
            showFilter={true}
            showSortBtn={true}
            showPagination={true}
            InputFileName="Pay Schedule"
            appliedFilt={appliedFilt}
            setAppliedFilt={setAppliedFilt}
          />
        )}
      </div>

      {/* Pay Schedule Form */}
      <PayScheduleForm
        open={formOpen}
        onCancel={() => {
          setFormOpen(false);
          setSelectedPaySchedule(null);
        }}
        paySchedule={selectedPaySchedule}
        onSuccess={fetchPaySchedules}
      />

      {/* View Pay Schedule Modal */}
      <ModalComponent
        visible={viewOpen}
        title="View Pay Schedule"
        setVisible={() => {
          setViewOpen(false);
          setViewPaySchedule(null);
        }}
        size="lg"
        footer={
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => {
                setViewOpen(false);
                setViewPaySchedule(null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        }
      >
         {loadingView ? (
          <div className="flex justify-center items-center py-10">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : viewPaySchedule ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pay Schedule Name
                </label>
                <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded border">
                  {viewPaySchedule.payScheduleName}
                </div>
              </div>
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pay Frequency
                </label>
                <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded border">
                  {getFrequencyLabel(viewPaySchedule.frequency)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Day of the Month
                </label>
                <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded border">
                  {viewPaySchedule.dayOfTheMonth || 'Not specified'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pay Period
                </label>
             <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded border">
                  {getFrequencyLabel(viewPaySchedule.frequency)}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Pay Date
                </label>
                <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded border">
                  {viewPaySchedule.payrollPaymentDate ? 
                    dayjs(viewPaySchedule.payrollPaymentDate).format('MMMM DD, YYYY') : 
                    'Not specified'
                  }
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deadline to Run Payroll
                </label>
                <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded border">
                  {viewPaySchedule.payrollDeadlineDate ? 
                    dayjs(viewPaySchedule.payrollDeadlineDate).format('MMMM DD, YYYY') : 
                    'Not specified'
                  }
                </div>
              </div>
            </div>
          </div>
                 ) : (
          <div className="flex justify-center items-center py-10">
            <div className="text-gray-500">No data available</div>
          </div>
        )}
      </ModalComponent>

      {/* Alert Modal */}
      <AlertModalComponent
        show={openModal}
        alertType={alertType}
        alertMessage={alertMsg}
        alertButtonMessage={alertButtonMessage}
        onClose={() => setOpenModal(false)}
      />

      {/* Confirmation Modal */}
      <ModalConfirmation
        {...confirmationModal}
        onClose={() => setConfirmationModal((prev) => ({ ...prev, open: false }))}
      />

    </div>
  );
};

export default PaySchedule;