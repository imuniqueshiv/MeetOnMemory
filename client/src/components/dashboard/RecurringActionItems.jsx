import React, { useState } from "react";
import {
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  message,
  Tooltip,
  Space,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FireOutlined,
} from "@ant-design/icons";
import {
  useRecurringActionItems,
  useCreateRecurringActionItem,
  useUpdateRecurringActionItem,
  useDeleteRecurringActionItem,
} from "../../hooks/useRecurringActionItems";
import RecurrencePatternBuilder from "../common/RecurrencePatternBuilder";

const RecurringActionItems = () => {
  const { data: recurringItems, isLoading } = useRecurringActionItems();
  const createMutation = useCreateRecurringActionItem();
  const updateMutation = useUpdateRecurringActionItem();
  const deleteMutation = useDeleteRecurringActionItem();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleDelete = (id) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success("Deleted successfully"),
    });
  };

  const handleSave = () => {
    form.validateFields().then((values) => {
      if (editingItem) {
        updateMutation.mutate(
          { id: editingItem.id, data: values },
          {
            onSuccess: () => {
              message.success("Updated successfully");
              setIsModalVisible(false);
            },
          },
        );
      } else {
        createMutation.mutate(values, {
          onSuccess: () => {
            message.success("Created successfully");
            setIsModalVisible(false);
          },
        });
      }
    });
  };

  const columns = [
    {
      title: "Task",
      dataIndex: "text",
      key: "text",
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: 12, color: "#888" }}>
            {record.description}
          </div>
        </div>
      ),
    },
    {
      title: "Pattern",
      dataIndex: "recurrencePattern",
      key: "recurrencePattern",
      render: (pattern) => <Tag color="blue">{pattern.toUpperCase()}</Tag>,
    },
    {
      title: "Streak",
      dataIndex: "currentStreak",
      key: "currentStreak",
      render: (streak) => (
        <Tooltip title={`Current streak: ${streak}`}>
          <Space>
            <FireOutlined
              style={{ color: streak > 0 ? "#fa8c16" : "#d9d9d9" }}
            />
            <span
              style={{
                color: streak > 0 ? "#fa8c16" : "#d9d9d9",
                fontWeight: "bold",
              }}
            >
              {streak}
            </span>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: "Stats",
      key: "stats",
      render: (_, record) => (
        <div style={{ fontSize: 12, color: "#666" }}>
          <div>Completed: {record.totalCompleted}</div>
          <div>Missed: {record.totalMissed}</div>
        </div>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          />
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDelete(record.id)}
            size="small"
          />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: "#fff", borderRadius: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h2>Recurring Action Items</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Add Recurring Item
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={recurringItems}
        rowKey="id"
        loading={isLoading}
      />

      <Modal
        title={editingItem ? "Edit Recurring Item" : "Create Recurring Item"}
        open={isModalVisible}
        onOk={handleSave}
        onCancel={() => setIsModalVisible(false)}
        okText="Save"
        confirmLoading={createMutation.isLoading || updateMutation.isLoading}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="text"
            label="Task Description"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Details">
            <Input.TextArea />
          </Form.Item>
          <Form.Item
            name="meetingSeriesId"
            label="Meeting Series ID"
            rules={[{ required: true }]}
          >
            <Input placeholder="Enter meeting series ID" />
          </Form.Item>

          <Form.Item name="patternConfig">
            <RecurrencePatternBuilder />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RecurringActionItems;
