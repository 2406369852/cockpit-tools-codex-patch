package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
)

const (
	parentLeaseVersion      = 1
	parentLeaseStateActive  = "active"
	parentLeaseStateHandoff = "handoff"
	parentLeasePollInterval = 200 * time.Millisecond
)

// parentProcessLease is written by Cockpit Tools before a relaunch. During a
// bounded handoff the sidecar intentionally outlives its original parent; the
// new app instance then claims it by publishing its PID with state "active".
type parentProcessLease struct {
	Version   int    `json:"version"`
	OwnerPID  int    `json:"ownerPid"`
	State     string `json:"state"`
	ExpiresAt int64  `json:"expiresAt"`
}

func readParentProcessLease(path string) (parentProcessLease, error) {
	var lease parentProcessLease
	data, err := os.ReadFile(path)
	if err != nil {
		return lease, err
	}
	if err := json.Unmarshal(data, &lease); err != nil {
		return lease, fmt.Errorf("decode parent lease: %w", err)
	}
	if err := validateParentProcessLease(lease); err != nil {
		return lease, err
	}
	return lease, nil
}

func validateParentProcessLease(lease parentProcessLease) error {
	if lease.Version != parentLeaseVersion {
		return fmt.Errorf("unsupported parent lease version %d", lease.Version)
	}
	if lease.OwnerPID <= 0 {
		return fmt.Errorf("invalid parent lease ownerPid %d", lease.OwnerPID)
	}
	switch lease.State {
	case parentLeaseStateActive:
		return nil
	case parentLeaseStateHandoff:
		if lease.ExpiresAt <= 0 {
			return fmt.Errorf("invalid parent lease expiresAt %d", lease.ExpiresAt)
		}
		return nil
	default:
		return fmt.Errorf("invalid parent lease state %q", lease.State)
	}
}

type parentLeaseDecision struct {
	exit     bool
	adopted  bool
	ownerPID int
	reason   string
}

type parentLeaseTracker struct {
	ownerPID int
}

func (tracker *parentLeaseTracker) evaluate(
	lease parentProcessLease,
	now time.Time,
	processAlive func(int) bool,
) parentLeaseDecision {
	if lease.State == parentLeaseStateHandoff {
		if now.UnixMilli() >= lease.ExpiresAt {
			return parentLeaseDecision{
				exit:     true,
				ownerPID: tracker.ownerPID,
				reason:   "parent_handoff_expired",
			}
		}
		return parentLeaseDecision{ownerPID: tracker.ownerPID}
	}

	if !processAlive(lease.OwnerPID) {
		return parentLeaseDecision{
			exit:     true,
			ownerPID: lease.OwnerPID,
			reason:   "parent_lease_owner_exit",
		}
	}

	previousOwnerPID := tracker.ownerPID
	tracker.ownerPID = lease.OwnerPID
	return parentLeaseDecision{
		adopted:  previousOwnerPID > 0 && previousOwnerPID != lease.OwnerPID,
		ownerPID: lease.OwnerPID,
	}
}

func monitorParentProcessLease(
	ctx context.Context,
	parentPID int,
	leasePath string,
	cancel context.CancelFunc,
	emitter *eventEmitter,
) {
	tracker := &parentLeaseTracker{ownerPID: parentPID}
	go func() {
		ticker := time.NewTicker(parentLeasePollInterval)
		defer ticker.Stop()

		lastState := ""
		leaseMissingSince := time.Time{}
		for {
			lease, err := readParentProcessLease(leasePath)
			if err != nil {
				// Cockpit publishes the lease with an atomic temp-file rename. On
				// Windows, readers can briefly observe the target as missing while
				// that rename is in flight; tolerate that short window instead of
				// killing a healthy sidecar during owner handoff.
				if os.IsNotExist(err) {
					if leaseMissingSince.IsZero() {
						leaseMissingSince = time.Now()
					}
					if time.Since(leaseMissingSince) < 5*time.Second {
						select {
						case <-ctx.Done():
							return
						case <-ticker.C:
							continue
						}
					}
				}
				if emitter != nil {
					emitter.emit(map[string]any{
						"type":   "parent_monitor_error",
						"reason": "parent_lease_read_failed",
						"path":   leasePath,
						"error":  err.Error(),
					})
				}
				cancel()
				return
			}
			leaseMissingSince = time.Time{}

			decision := tracker.evaluate(lease, time.Now(), isProcessAlivePlatform)
			if decision.adopted && emitter != nil {
				emitter.emit(map[string]any{
					"type":      "parent_adopted",
					"parentPid": decision.ownerPID,
				})
			}
			if lease.State == parentLeaseStateHandoff && lastState != parentLeaseStateHandoff && emitter != nil {
				emitter.emit(map[string]any{
					"type":      "parent_handoff",
					"parentPid": tracker.ownerPID,
					"expiresAt": lease.ExpiresAt,
				})
			}
			lastState = lease.State
			if decision.exit {
				if emitter != nil {
					emitter.emit(map[string]any{
						"type":      "parent_exit",
						"reason":    decision.reason,
						"parentPid": decision.ownerPID,
					})
				}
				cancel()
				return
			}

			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
}

func monitorParentProcessWithLease(
	ctx context.Context,
	parentPID int,
	leasePath string,
	cancel context.CancelFunc,
	emitter *eventEmitter,
) {
	if strings.TrimSpace(leasePath) != "" {
		monitorParentProcessLease(ctx, parentPID, leasePath, cancel, emitter)
		return
	}
	monitorParentProcess(ctx, parentPID, cancel, emitter)
}
