import React, { useState } from "react";
import { Form, Select, InputNumber, Row, Col, Typography } from "antd";

const { Option } = Select;
const { Text } = Typography;

const RecurrencePatternBuilder = ({ value, onChange }) => {
  const [pattern, setPattern] = useState(value?.recurrencePattern || "weekly");

  const handlePatternChange = (val) => {
    setPattern(val);
    triggerChange({ recurrencePattern: val });
  };

  const handleDayOfWeekChange = (val) => {
    triggerChange({ dayOfWeek: val });
  };

  const handleDayOfMonthChange = (val) => {
    triggerChange({ dayOfMonth: val });
  };

  const triggerChange = (changedValue) => {
    onChange?.({
      recurrencePattern: pattern,
      dayOfWeek: value?.dayOfWeek,
      dayOfMonth: value?.dayOfMonth,
      ...value,
      ...changedValue,
    });
  };

  return (
    <div
      style={{
        border: "1px solid #d9d9d9",
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
      }}
    >
      <Text strong>Recurrence Pattern</Text>
      <Row gutter={16} style={{ marginTop: 12 }}>
        <Col span={8}>
          <Form.Item label="Frequency">
            <Select value={pattern} onChange={handlePatternChange}>
              <Option value="daily">Daily</Option>
              <Option value="weekly">Weekly</Option>
              <Option value="biweekly">Biweekly</Option>
              <Option value="monthly">Monthly</Option>
            </Select>
          </Form.Item>
        </Col>
        {(pattern === "weekly" || pattern === "biweekly") && (
          <Col span={8}>
            <Form.Item label="Day of Week">
              <Select
                value={value?.dayOfWeek}
                onChange={handleDayOfWeekChange}
                placeholder="Select day"
              >
                <Option value={0}>Sunday</Option>
                <Option value={1}>Monday</Option>
                <Option value={2}>Tuesday</Option>
                <Option value={3}>Wednesday</Option>
                <Option value={4}>Thursday</Option>
                <Option value={5}>Friday</Option>
                <Option value={6}>Saturday</Option>
              </Select>
            </Form.Item>
          </Col>
        )}
        {pattern === "monthly" && (
          <Col span={8}>
            <Form.Item label="Day of Month">
              <InputNumber
                min={1}
                max={31}
                value={value?.dayOfMonth}
                onChange={handleDayOfMonthChange}
                placeholder="e.g. 15"
                style={{ width: "100%" }}
              />
            </Form.Item>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default RecurrencePatternBuilder;
